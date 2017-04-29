#!/usr/bin/env node
const createAden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const Logger = require('./lib/aden.logger');
const path = require('path');
const _ = require('lodash');
const pckgJson = require('./package.json');
const open = require('open');
const cluster = require('cluster');

/**
 * Aden CLI
 */
program
  .usage('[rootpath][options]')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-d, --dev', 'Run in development mode (live reload)')
  .option('-n, --new [path]', 'Bootstrap a new page')
  .option('--nd [path]', 'Bootstrap a new page and start the dev server')
  .option('-w, --workers [num]', 'Start with given [num] of workers')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-f, --focus [path]', 'Choose one route to focus on. Mount only that.')
  .option('-p, --port [port]', 'Override the port to mount the server on')
  .option('--debug', 'Debug output')
  .option('-s, --silent', 'Do not output anything on purpose')
  // TODO: .option('--dd', 'Dev and debug')
  .option('-v, --verbose', 'Output a lot')
  // IDEA: .option('--export', 'Export the generated webpack config')
  // IDEA: .option('--export-js', 'Export the generated webpack config as JSObject')

  // (?) Eject would create all the boilerplate again so you can "run your own app"
  // -> generates the webpack config once for the project
  // -> sets up scripts to run the build and a dev server
  // TODO: .option('--eject', 'Setup the project to run standalone webpack builds without aden')

  .option('--logger-no-date', 'Omit date from log output')
  .version(pckgJson.version)
  .parse(process.argv);

const loggerOptions = {
  silent: program.silent || false,
  verbose: program.verbose || process.env.NODE_VERBOSE || false,
  debug: program.debug || false,
  noDate: !program.loggerDate || false,
};

const logger = (new Logger(_.extend(loggerOptions, {
  name: 'aden',
}))).fns;

if (program.dev || program.new || program.nd) {
  logger.warn('Ahoy! Running in dev env.');
} else {
  logger.info(`Running in ${process.env.NODE_ENV || 'production (by default)'} env.`);
}

const app = express();
const config = {
  logger: loggerOptions,
  dev: program.dev || program.new || program.nd || false,
};

// What to do with multiple paths? Start one process per path.
const rootPath = path.resolve('./', program.args[0] || '');

logger.debug('cli config ', {
  rootPath,
  config,
});

const runServer = (aden, doOpen) => Promise.resolve().then(() => new Promise((resolve, reject) => {
  const port = parseInt(program.port, 10) || process.env.PORT || aden.rootConfig.port || 5000;
  aden.app.listen(port, (err) => {
    if (err) {
      reject(err);
      return;
    }

    const type = cluster.isMaster ? 'server' : 'worker';

    aden.logger.success(`Started ${type} at port ${port}`);

    if (doOpen) {
      open(`http://localhost:${port}`);
    }

    resolve(aden);
  });
}));

const numberOfWorkers = (workersById) => Object.keys(workersById)
  .filter((key) => workersById.hasOwnProperty(key))
  .length;

let run = null;

if (program.build) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('build'))
    .then(() => {
      logger.success('Build only done. Exiting.');
      process.exit(0);
    });
}

if (program.new || program.nd) {
  const bootstrapPath = path.resolve(rootPath, program.new || program.nd);
  run = createAden(app, config)
    .bootstrap(bootstrapPath)
    .then((aden) => aden.init(bootstrapPath, program.focus))
    .then((aden) => aden.run('dev'))
    .then((aden) => runServer(aden, true));
}

if (!run && program.clean) {
  run = createAden(app, config)
    .init(rootPath, program.focus)
    .then((aden) => aden.run('clean'))
    .then(() => {
      logger.success('Clean up done. Exiting.');
      process.exit(0);
    });
}

if (!run && program.dev) {
  run = createAden(app, config)
    .init(rootPath, program.focus)
    .then((aden) => aden.run('dev'))
    .then((aden) => runServer(aden));
}

if (!run) {
  // Default clustering for production
  if (program.workers && cluster.isMaster) {
    run = Promise.resolve().then(() => {
      const max = parseInt(program.workers, 10);
      const workersById = {};
      let numWorkersListening = 0;
      let exitStatus = 0;

      cluster.on('fork', (worker) => {
        logger.info(`Forked worker ${worker.id}`);
        workersById[worker.id] = worker;

        worker.on('error', (err) => {
          logger.error('Worker Error', err);
        });

        worker.on('exit', (code, signal) => {
          delete workersById[worker.id];
          numWorkersListening--;

          if (code > 0) {
            logger.error('Worker Exit with Error', { code, signal });
            exitStatus = 1;
            // TODO: Determine if viable for restart
          } else {
            logger.info('Worker Exit Normal', { code, signal });
          }

          const numWorkers = numberOfWorkers(workersById);
          if (numWorkers === 0) {
            logger.info('No workers left, exiting');
            process.exit(exitStatus);
          }
        });
      });

      cluster.on('listening', (worker, address) => {
        logger.success(`Worker ${worker.id} listening at ${address.address
          || '127.0.0.1'}:${address.port}`);

        numWorkersListening++;
        if (numWorkersListening === max) {
          logger.success(`${numWorkersListening} workers listening at ${address.address
            || '127.0.0.1'}:${address.port}`);
        }
      });

      // Initial fork
      for (let i = 0; i < max; i++) {
        cluster.fork();
      }
    });
  } else {
    run = createAden(app, config)
      .init(rootPath, program.focus)
      .then((aden) => aden.run('production'))
      .then((aden) => runServer(aden));
  }
}

run.catch((err) => {
  logger.error('FATAL:', err, err._reason ? err._reason.stack : null);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

process.on('uncaughtException', (ex) => {
  logger.error('FATAL: Uncaught Exception', ex);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('FATAL: Unhandled Promise Rejection', reason);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});
