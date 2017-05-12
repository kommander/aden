/* eslint-disable max-len, no-console */

const chalk = require('chalk');
const moment = require('moment');
const util = require('util');
const _ = require('lodash');

const logDateFormat = 'YYYY-MM-DD hh:mm:ss.SSS';

// TODO: Do not color code in production
const formatInfoMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray('\u272A')} ${chalk.gray(namespace)} ${msg}`;

const formatDebugMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray('\u22C5')} ${chalk.gray(namespace)} ${chalk.gray(msg)}`;

const formatErrorMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.red('✗')} ${chalk.red.bold(namespace)} ${msg}`;

const formatWarnMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.yellow('\u26A0')} ${chalk.yellow.bold(namespace)} ${chalk.bold(msg)}`;

const formatStartMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.blue('\u2023')} ${chalk.blue.bold(namespace)} ${msg}`;

const formatSuccessMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.green('\u2713')} ${chalk.green.bold(namespace)} ${msg}`;


// TODO: Replace console.log with setable write stream
function Logger(opts = {}) {
  if (!(this instanceof Logger)) {
    return new Logger(opts);
  }
  this.options = opts;
}

function maybeEmpty(stuff) {
  return stuff ? util.inspect(stuff, { depth: 6 }) : '';
}

// TODO: allow --debug [namespace]
Logger.prototype.namespace = function namespace(name, opts = {}) {
  if (!name) throw new Error('need a name');

  const options = _.extend({
    silent: true,
    verbose: false,
    debug: process.env.DEBUG || false,
    noDate: false,
    stdStream: process.stdout,
    errStream: process.stderr,
  }, this.options, opts);

  const stdStream = (...rest) => options.stdStream.write(`${rest.join(' ')}\n`);
  const errStream = (...rest) => options.errStream.write(`${rest.join(' ')}\n`);

  if (process.env.ADEN_FORCE_LOG === 'true') {
    Object.assign(options, {
      silent: false,
    });
  }

  const applyDate = (msg) => {
    if (options.noDate) {
      return msg;
    }
    const date = chalk.cyan(moment().format(logDateFormat));
    return `${date} ${msg}`;
  };

  if (!options.silent) {
    let infoFn;
    let errFn;
    let warnFn;
    let debugFn;
    let startFn;
    let successFn;
    if (options.verbose) {
      infoFn = (msg) =>
        stdStream(applyDate(formatInfoMsg(msg, name)));
      errFn = (msg, err, data) =>
        errStream(
          applyDate(formatErrorMsg(msg, name)),
          err ? err.stack || err : '',
          maybeEmpty(data)
        );
      warnFn = (msg, data) =>
        stdStream(
          applyDate(formatWarnMsg(msg, name)),
          maybeEmpty(data)
        );
      debugFn = (msg, dat1, dat2, dat3) =>
        stdStream(
          applyDate(formatDebugMsg(msg, name)),
          maybeEmpty(dat1),
          maybeEmpty(dat2),
          maybeEmpty(dat3)
        );
      startFn = (msg, data) =>
        stdStream(
          applyDate(formatStartMsg(msg, name)),
          maybeEmpty(data)
        );
      successFn = (msg, data) =>
        stdStream(
          applyDate(formatSuccessMsg(msg, name)),
          maybeEmpty(data)
        );
    } else {
      infoFn = (msg) => stdStream(applyDate(formatInfoMsg(msg, name)));
      errFn = options.debug
        ? (msg, err, data) => errStream(
          applyDate(formatErrorMsg(msg, name)),
          err ? err.stack || err : '',
          maybeEmpty(data || null)
        )
        : (msg, err) => errStream(
          applyDate(formatErrorMsg(msg, name)),
          err ? err.stack || err : ''
        );
      warnFn = (msg, data) =>
        stdStream(
          applyDate(formatWarnMsg(msg, name)),
          maybeEmpty(data)
        );
      debugFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatDebugMsg(msg, name)),
          maybeEmpty(data)
        )
        : () => true;
      startFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatStartMsg(msg, name)),
          maybeEmpty(data)
        )
        : (msg) => stdStream(applyDate(formatStartMsg(msg, name)));
      successFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatStartMsg(msg, name)),
          maybeEmpty(data)
        )
        : (msg) => stdStream(applyDate(formatSuccessMsg(msg, name)));
    }

    return {
      info: infoFn,
      debug: debugFn,
      warn: warnFn,
      error: errFn,
      start: startFn,
      success: successFn,
      namespace: this.namespace.bind(this),
    };
  }

  return {
    info: () => true,
    warn: options.debug
      ? (msg, data) => stdStream(
        applyDate(formatWarnMsg(msg, name)),
        maybeEmpty(data)
      )
      : () => true,
    debug: () => true,
    error: options.debug
      ? (msg, err, data) => errStream(
        applyDate(formatErrorMsg(msg, name)),
        err ? err.stack || err : '',
        maybeEmpty(data || null)
      )
      : () => true,
    start: () => true,
    success: () => true,
    namespace: this.namespace.bind(this),
  };
};

module.exports = Logger;
