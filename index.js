#!/usr/bin/env node
const createAden = require('./lib/aden');
const program = require('commander');
const logger = require('./lib/aden.logger');
const path = require('path');
const pckgJson = require('./package.json');
const open = require('open');
const cluster = require('cluster');
const chalk = require('chalk');
const os = require('os');

/**
 * Aden CLI
 */

const collectAttitudes = (val, memo) => memo.concat(val);

program._name = 'aden';

program
  .usage('<command> [rootPath] [options]')
  .option('-f, --focus <path>', 'Choose one route to focus on. Mount only that.')
  .option('-w, --workers [num]', 'Start with given [num] of workers, or all CPUs.')
  .option('-p, --port <port>', 'Override the port to mount the server on')
  .option('-u, --use <attitude>', 'Specify attitude(s) to use', collectAttitudes, [])
  .option('-s, --silent', 'Do not output anything on purpose')
  .option('--pretty', 'Use prettyjson to format log output')
  .option('--debug', 'Debug output')

  // TODO: --docs to run docs from package and open browser (different default port)
  // TODO: Provide an install switch -i --install with a task that attitudes can hook into

  // (?) Eject would create all the boilerplate again so you can "run your own app"
  // -> generates the webpack config once for the project
  // -> sets up scripts to run the build and a dev server
  // TODO: .option('--eject', 'Setup the project to run standalone webpack builds without aden')

  .option('--log-no-date', 'Omit date from log output')
  .version(pckgJson.version);

let log;
let config;

const resolveRootPath = (rootPath) => path.resolve('./', rootPath || '');

const numberOfWorkers = (workersById) => Object.keys(workersById)
  .filter((key) => workersById.hasOwnProperty(key))
  .length;

const fatalErrorHandler = (err) => {
  log.error('FATAL:', err, err._reason ? err._reason.stack : null);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
};

const runServer = (aden, doOpen) => Promise.resolve().then(() => new Promise((resolve, reject) => {
  const splitPort = program.port
    ? program.port.split(':')
    : [process.env.PORT || aden.rootConfig.port || 5000];
  const port = splitPort[splitPort.length > 1 ? 1 : 0];
  const hostName = splitPort.length > 1
    ? splitPort[0]
    : (process.env.HOSTNAME || aden.rootConfig.hostname || null);

  const gracefulShutdown = () => {
    aden.shutdown(() => process.exit(0));
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  aden.app.listen(port, hostName, (err) => {
    if (err) {
      reject(err);
      return;
    }

    const mountAddress = hostName || 'localhost';
    const type = cluster.isMaster ? 'server' : 'worker';

    let data;
    if (type === 'server') {
      data = {
        address: mountAddress,
        port,
      };
      log.event('ready', data);
    }

    log.success(`Started ${type} at ${hostName || 'localhost'}:${port}`);

    /* istanbul ignore next */
    if (doOpen) {
      open(`http://${hostName || 'localhost'}:${port}`);
    }

    resolve(aden);
  });
}));

const deriveConfig = (prog, logOptions, dev) => ({
  logger: logOptions,
  attitudes: prog.use,
  dev,
});

const getLogOptions = (prog) => ({
  silent: prog.silent || false,
  debug: prog.debug || false,
  noDate: !prog.logDate || false,
  pretty: prog.pretty || false,
});

const initLogger = (dev, logOptions) => {
  const log = logger(logOptions).namespace('aden-cli'); // eslint-disable-line

  if (cluster.isMaster) {
    if (dev) {
      log.raw(chalk.cyan('           _'));
      log.raw(chalk.cyan('          | |'));
      log.raw(chalk.cyan(' _____  __| |_____ ____'));
      log.raw(chalk.cyan('(____ |/ _  | ___ |  _ \\'));
      log.raw(chalk.cyan('/ ___ ( (_| | ____| | | |'));
      log.raw(chalk.cyan('\\_____|\\____|_____)_| |_|.zwerk.io'));
      log.warn('Ahoy! Running in dev env.');
    } else {
      log.info(`Running in ${process.env.NODE_ENV || 'production (by default)'} env.`);
    }
  }

  return log;
};

const initLogAndConfig = (opts) => {
  const logOptions = getLogOptions(program);
  log = initLogger(opts.dev, logOptions);
  config = deriveConfig(program, logOptions, opts.dev);
};

program
  .command('start [rootPath]')
  .alias('s')
  .description('Run in production mode')
  .action((rootPath) => {
    initLogAndConfig({ dev: false });

    // Default clustering for production
    if (program.workers && cluster.isMaster) {
      const numCpus = os.cpus().length;
      Promise.resolve().then(() => {
        const max = parseInt(program.workers, 10) || numCpus;

        /* istanbul ignore next */
        if (max > numCpus) {
          log.warn(`Starting more workers than CPUs available (${max}/${numCpus})`);
        }

        const workersById = {};
        let numWorkersListening = 0;
        let exitStatus = 0;
        const gracefulShutdown = () => {
          Object.keys(workersById).forEach((key) => {
            workersById[key].kill('SIGTERM');
          });
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

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
              log.error('Worker Exit with Error', new Error(`Worker error code: ${code}`));
              exitStatus = 1;
              // TODO: Determine if viable for restart
              //       -> default would be:
              //         isAppLevelError ? restart() : err & shutdown
              //       -> use aden.registerHooks(['master:start', 'worker:error', ...])
              //        -> Let attitudes hook into cluster setup and determine restart viablility
            } else {
              log.info('Worker Exit Normal');
            }

            log.event('worker:shutdown', { code, signal, id: worker.id });

            const numWorkers = numberOfWorkers(workersById);
            if (numWorkers === 0) {
              log.info('No workers left, exiting');
              log.event('shutdown:complete');
              process.exit(exitStatus);
            }
          });
        });

        cluster.on('listening', (worker, address) => {
          const mountAddress = address.address || 'localhost';

          log.success(`Worker ${worker.id} listening at ${mountAddress}:${address.port}`);

          numWorkersListening++;
          if (numWorkersListening === max) {
            log.success(
              `${numWorkersListening} workers listening at ${mountAddress}:${address.port}`);
            log.event('ready', {
              address: mountAddress,
              port: address.port,
            });
          }
        });

        // Initial fork
        for (let i = 0; i < max; i++) {
          cluster.fork();
        }
      });
    } else {
      createAden(Object.assign(config, { dev: false }))
        .init(resolveRootPath(rootPath), program.focus)
        .then((aden) => aden.run('production'))
        .then((aden) => runServer(aden))
        .catch(fatalErrorHandler);
    }
  });

program
  .command('dev [rootPath]')
  .alias('d')
  .description('Run in development mode (live reload)')
  .action((rootPath) => {
    initLogAndConfig({ dev: true });
    createAden(config)
      .init(resolveRootPath(rootPath), program.focus)
      .then((aden) => aden.run('dev'))
      .then((aden) => runServer(aden))
      .catch(fatalErrorHandler);
  });

program
  .command('build [rootPath]')
  .alias('b')
  .description('Will create a production build and exit')
  .action((rootPath) => {
    initLogAndConfig({ dev: false });
    createAden(config)
      .init(resolveRootPath(rootPath), program.focus)
      .then((aden) => aden.run('build'))
      .then(() => {
        log.event('build:done');
        process.exit(0);
      })
      .catch(fatalErrorHandler);
  });

program
  .command('clean [rootPath]')
  .alias('c')
  .description('Remove all .dist folders')
  .action((rootPath) => {
    initLogAndConfig({ dev: false });
    createAden(config)
      .init(resolveRootPath(rootPath), program.focus)
      .then((aden) => aden.run('clean'))
      .then(() => {
        log.event('clean:done');
        process.exit(0);
      })
      .catch(fatalErrorHandler);
  });

program
  .command('deploy [rootPath] [target]')
  .description('Run deploy task with default or given target(s)')
  .action((...rest) => {
    initLogAndConfig({ dev: false });
    createAden(config)
      .init(resolveRootPath(rest[1] ? rest[1] : rest[0]), program.focus)
      .then((aden) => aden.run('deploy', { target: rest[1] || null }))
      .then(() => {
        log.event('deploy:done');
        process.exit(0);
      })
      .catch(fatalErrorHandler);
  });

/* eslint-disable */
program.on('--help', () => {
  console.log('Issues and PRs welcome at https://github.com/kommander/aden');
});
/* eslint-enable */

process.on('uncaughtException', (ex) => {
  if (!log) initLogAndConfig({ dev: false });
  log.error('FATAL: Uncaught Exception', ex);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  if (!log) initLogAndConfig({ dev: false });
  log.error('FATAL: Unhandled Promise Rejection', reason);
  if (process.env.NODE_ENV !== 'development' && !program.dev) {
    process.exit(1);
  }
});

program.parse(process.argv);

if (program.args.length < 2) {
  program.help();
}
