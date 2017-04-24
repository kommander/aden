#!/usr/bin/env node
const createAden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const Logger = require('./lib/aden.logger');
const path = require('path');
const _ = require('lodash');
const pckgJson = require('./package.json');
const open = require('open');

/**
 * Aden CLI
 */
program
  .usage('[options]')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-d, --dev', 'Run in development mode (live reload)')
  .option('-n, --new [path]', 'Bootstrap a new page')
  .option('--nd [path]', 'Bootstrap a new page and start the dev server')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-f, --focus [path]', 'Choose one route to focus on. Mount only that.')
  .option('-p, --port [port]', 'Override the port to mount the server on')
  .option('--debug', 'Debug output')
  .option('-s, --silent', 'Do not output anything on purpose')
  // TODO: .option('--dd', 'Dev and debug')
  .option('-v, --verbose', 'Output a lot')
  // IDEA: .option('--export', 'Export the generated webpack config')
  // IDEA: .option('--export-js', 'Export the generated webpack config as JSObject')
  .option('--logger-no-date', 'Omit date from log output')
  .option('--version', 'Show version string')
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

if (process.env.NODE_ENV === 'development'
  || program.dev || program.new || program.nd) {
  logger.warn('Ahoy! Running in dev env.');
} else {
  logger.info(`Running in ${process.env.NODE_ENV || 'production (by default)'} env.`);
}

const app = express();
const config = {
  logger: loggerOptions,
  dev: program.dev || program.new || program.nd || process.env.NODE_ENV === 'development' || false,
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
    aden.logger.success(`Started server at port ${port}`);

    if (doOpen) {
      open(`http://localhost:${port}`);
    }

    resolve(aden);
  });
}));

let run = null;

if (program.build) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('build'));
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
    .then((aden) => aden.run('clean'));
}

if (!run && program.dev) {
  run = createAden(app, config)
    .init(rootPath, program.focus)
    .then((aden) => aden.run('dev'))
    .then((aden) => runServer(aden));
}

if (!run) {
  run = createAden(app, config)
    .init(rootPath, program.focus)
    .then((aden) => aden.run('production'))
    .then((aden) => runServer(aden));
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
