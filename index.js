#!/usr/bin/env node
const createAden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const Logger = require('./lib/aden.logger');
const path = require('path');

/**
 * Aden CLI
 */
program
  .usage('[options]')
  .option('-p, --port [port]', 'Specifiy the port to mount the server on or $PORT')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-s, --silent', 'Do not output anything on purpose')
  .option('-d, --dev', 'Run in development mode')
  .option('--debug', 'Debug output')
  // TODO: .option('-dd', 'Dev and debug')
  .option('-v, --verbose', 'Output a lot')
  // TODO: .option('--focus', 'Choose one route to focus on. Mount only that.')
  // TODO: .option('--export', 'Export the generated webpack config')
  // TODO: .option('--export-js', 'Export the generated webpack config as JSObject')
  // TODO: .option('--no-statics', 'Disable statics serving')
  // Do not add -f to make it harder to mis-use
  // TODO: .option('--force', 'Enforce running even without .aden file in path')
  .option('--logger-no-date', 'Omit date from log output')
  .parse(process.argv);

const logger = (new Logger({
  name: 'aden',
  silent: program.silent || false,
  verbose: program.verbose || process.env.NODE_VERBOSE || false,
  debug: program.debug || false,
  noDate: !program.loggerDate || false,
})).fns;

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

if (process.env.NODE_ENV === 'development') {
  logger.warn('Ahoy! Running in dev env.');
} else {
  logger.info(`Running in ${process.env.NODE_ENV || 'default production'} env.`);
}

const app = express();
const config = {
  // What to do with multiple paths? Start one process per path.
  buildOnly: program.build || false,
  cleanOnly: program.clean || false,
  logger: {
    verbose: program.verbose || process.env.NODE_VERBOSE || false,
    silent: program.silent || false,
    debug: program.debug || false,
    noDate: !program.loggerDate || false,
  },
  dev: program.dev || process.env.NODE_ENV === 'development' || false,
};

const rootPath = path.resolve('./', program.args[0]);

logger.debug('cli config ', {
  rootPath,
  config,
});

// Note: Hand over program options as config to bootstrap and then aden itself,
//       >> Do not rely on app.program
createAden(app, config).init(rootPath).then((aden) => {
  const port = process.env.PORT || parseInt(program.port, 10) || aden.rootPage.port || 5000;
  app.listen(port, () => aden.logger.success(`Started server at port ${port}`));
}).catch((err) => {
  logger.error('FATAL:', err, err._reason ? err._reason.stack : null);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});
