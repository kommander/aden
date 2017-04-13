#!/usr/bin/env node
const createAden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const Logger = require('./lib/aden.logger');
const path = require('path');
const _ = require('lodash');
const pckgJson = require('./package.json');

/**
 * Aden CLI
 */
program
  .usage('[options]')
  .option('-p, --port [port]', 'Override the port to mount the server on')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-s, --silent', 'Do not output anything on purpose')
  .option('-d, --dev', 'Run in development mode')
  .option('--debug', 'Debug output')
  // TODO: .option('-dd', 'Dev and debug')
  .option('-v, --verbose', 'Output a lot')
  .option('--focus [path]', 'Choose one route to focus on. Mount only that.')
  // TODO: .option('--export', 'Export the generated webpack config')
  // TODO: .option('--export-js', 'Export the generated webpack config as JSObject')
  // TODO: .option('--no-statics', 'Disable statics serving')
  // Do not add -f to make it harder to mis-use
  // TODO: .option('--force', 'Enforce running even without .aden file in path')
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

process.on('uncaughtException', (ex) => {
  logger.error('FATAL: Uncaught Exception', ex);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('FATAL: Unhandled Promise Rejection', reason);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

if (process.env.NODE_ENV === 'development' || program.dev) {
  logger.warn('Ahoy! Running in dev env.');
} else {
  logger.info(`Running in ${process.env.NODE_ENV || 'default production'} env.`);
}

const app = express();
const config = {
  logger: loggerOptions,
  dev: program.dev || process.env.NODE_ENV === 'development' || false,
};

// What to do with multiple paths? Start one process per path.
const rootPath = path.resolve('./', program.args[0] || '');

logger.debug('cli config ', {
  rootPath,
  config,
});

let run = null;

if (program.build) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('build'));
}

if (!run && program.clean) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('clean'));
}

const runServer = (aden) => {
  const port = parseInt(program.port, 10) || process.env.PORT || aden.rootConfig.port || 5000;
  app.listen(port, () => aden.logger.success(`Started server at port ${port}`));
};

if (!run && program.dev) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('dev'))
    .then((aden) => runServer(aden));
}

if (!run) {
  run = createAden(app, config).init(rootPath, program.focus)
    .then((aden) => aden.run('production'))
    .then((aden) => runServer(aden));
}

run.catch((err) => {
  logger.error('FATAL:', err, err._reason ? err._reason.stack : null);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});
