#!/usr/bin/env node
const createAden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const logger = require('./lib/aden.logger');
const path = require('path');
const pckgJson = require('./package.json');
const open = require('open');
const cluster = require('cluster');

/**
 * Aden CLI
 */

const collectAttitudes = (val, memo) => memo.concat(val);

program
  .usage('[options] <rootpath ...>')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-d, --dev', 'Run in development mode (live reload)')
  .option('-w, --workers [num]', 'Start with given [num] of workers, or all CPUs.')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-f, --focus [path]', 'Choose one route to focus on. Mount only that.')
  .option('-p, --port [port]', 'Override the port to mount the server on')
  .option('-u, --use [attitude]', 'Specify an attitude to use (multi)', collectAttitudes, [])
  .option('--debug', 'Debug output')
  .option('-n, --new [path]', 'Bootstrap a new page')
  .option('--nd [path]', 'Bootstrap a new page and start the dev server')
  .option('-s, --silent', 'Do not output anything on purpose')
  .option('-v, --verbose', 'Output a lot')

  // (?) Eject would create all the boilerplate again so you can "run your own app"
  // -> generates the webpack config once for the project
  // -> sets up scripts to run the build and a dev server
  // TODO: .option('--eject', 'Setup the project to run standalone webpack builds without aden')

  .option('--log-no-date', 'Omit date from log output')
  .version(pckgJson.version);

/* eslint-disable */
program.on('--help', () => {
  console.log('Issues and PRs welcome at https://github.com/kommander/aden');
});
/* eslint-enable */

program.parse(process.argv);

const logOptions = {
  silent: program.silent || false,
  verbose: program.verbose || process.env.NODE_VERBOSE || false,
  debug: program.debug || false,
  noDate: !program.logDate || false,
};

const log = logger(logOptions).namespace('aden cli'); // eslint-disable-line

if (program.dev || program.new || program.nd) {
  log.warn('Ahoy! Running in dev env.');
} else {
  log.info(`Running in ${process.env.NODE_ENV || 'production (by default)'} env.`);
}

const app = express();
const config = {
  logger: logOptions,
  dev: program.dev || program.new || program.nd || false,
  attitudes: program.use,
};

const rootPath = path.resolve('./', program.args[0] || '');

log.debug('cli config ', {
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

    aden.log.success(`Started ${type} at port ${port}`);

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
      log.success('Build only done. Exiting.');
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
      log.success('Clean up done. Exiting.');
      process.exit(0);
    });
}

if (!run && program.dev) {
  process.traceDeprecation = true;
  run = createAden(app, config)
    .init(rootPath, program.focus)
    .then((aden) => aden.run('dev'))
    .then((aden) => runServer(aden));
}

if (!run) {
  // Default clustering for production
  if (program.workers && cluster.isMaster) {
    run = Promise.resolve().then(() => {
      const max = parseInt(program.workers, 10) || require('os').cpus().length;
      const workersById = {};
      let numWorkersListening = 0;
      let exitStatus = 0;

      cluster.on('fork', (worker) => {
        log.info(`Forked worker ${worker.id}`);
        workersById[worker.id] = worker;

        worker.on('error', (err) => {
          log.error('Worker Error', err);
        });

        worker.on('exit', (code, signal) => {
          delete workersById[worker.id];
          numWorkersListening--;

          if (code > 0) {
            log.error('Worker Exit with Error', { code, signal });
            exitStatus = 1;
            // TODO: Determine if viable for restart
          } else {
            log.info('Worker Exit Normal', { code, signal });
          }

          const numWorkers = numberOfWorkers(workersById);
          if (numWorkers === 0) {
            log.info('No workers left, exiting');
            process.exit(exitStatus);
          }
        });
      });

      cluster.on('listening', (worker, address) => {
        log.success(`Worker ${worker.id} listening at ${address.address
          || '127.0.0.1'}:${address.port}`);

        numWorkersListening++;
        if (numWorkersListening === max) {
          log.success(`${numWorkersListening} workers listening at ${address.address
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
  log.error('FATAL:', err, err._reason ? err._reason.stack : null);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

process.on('uncaughtException', (ex) => {
  log.error('FATAL: Uncaught Exception', ex);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  log.error('FATAL: Unhandled Promise Rejection', reason);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});
