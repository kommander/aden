#!/usr/bin/env node
const Aden = require('./lib/aden');
const express = require('express');
const program = require('commander');
const Logger = require('./lib/aden.logger');

/**
 * Aden CLI
 */
program
  .usage('[options]')
  .option('-p, --port [port]', 'Specifiy the port to mount the server on')
  .option('-b, --build', 'Will only build out the app assets and exit (not start the server)')
  .option('-c, --clean', 'Remove all dist folders')
  .option('-s, --silent', 'Do not output anything on purpose')
  .option('-d, --dev', 'Run in development mode')
  .option('--debug', 'Debug output')
  // TODO: .option('-dd', 'Dev and debug')
  .option('-v, --verbose', 'Output a lot')
  // TODO: .option('--dist', 'Override the dist path')
  // TODO: .option('--focus', 'Choose one route to focus on. Mount only that.')
  // TODO: .option('--export', 'Export the generated webpack config')
  // TODO: .option('--export-js', 'Export the generated webpack config as JSObject')
  // TODO: .option('--no-statics', 'Disable statics serving')
  // TODO: .option('--force', 'Enforce running even without .aden file in path')
  .parse(process.argv);

const logger = (new Logger({
  silent: program.silent,
  verbose: program.verbose,
  debug: program.debug,
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
}

const app = express();

// Note: Hand over program options as config to bootstrap and then aden itself,
//       >> Do not rely on app.program
const aden = new Aden(app, {
  // What to do with multiple paths? Start one process per path.
  path: program.args[0] || process.cwd(),
  buildOnly: program.build,
  cleanOnly: program.clean,
  logger: {
    verbose: program.verbose,
    silent: program.silent,
    debug: program.debug,
  },
  dev: program.dev || process.env.NODE_ENV === 'development',
});

aden.init().then(() => {
  const port = process.env.PORT || parseInt(program.port, 10) || aden.rootPage.port || 5000;
  app.listen(port, () => aden.logger.success(`Started server at port ${port}`));
}).catch((err) => {
  logger.error('FATAL:', err);
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});
