const chalk = require('chalk');
const moment = require('moment');

const logDateFormat = 'YYYY-MM-DD hh:mm:ss.SSS';

const formatInfoMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.gray('\u272A')} ${chalk.gray(namespace)} ${msg}`;
};
const formatDebugMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.gray('\u22C5')} ${chalk.gray(namespace)} ${chalk.gray(msg)}`;
};
const formatErrorMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.red('✗')} ${chalk.red.bold(namespace)} ${msg}`;
};
const formatWarnMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.yellow('\u26A0')} ${chalk.yellow.bold(namespace)} ${chalk.bold(msg)}`;
};
const formatStartMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.blue('\u2023')} ${chalk.blue.bold(namespace)} ${msg}`;
};
const formatSuccessMsg = (msg, namespace) => {
  const date = chalk.cyan(moment().format(logDateFormat));
  return `${date} [${chalk.gray(process.pid)}] ${chalk.green('\u2713')} ${chalk.green.bold(namespace)} ${msg}`;
};

// TODO: Replace console.log with setable write stream
function Logger(opts = {}) {
  if (!(this instanceof Logger)) {
    return new Logger(opts);
  }
  this.options = opts;
  this.name = opts.name || 'global';
  this.fns = this.namespace(this.name, opts);

  if (process.env.NODE_ENV === 'development') {
    console.log(formatWarnMsg('Running in dev env.', 'Ahoy!'));
  }
}

Logger.prototype.namespace = function (namespace, opts) {
  if (!namespace) throw new Error('need a name');

  const options = opts || this.options;
  options.silent = this.options.silent ? this.options.silent : options.silent;
  options.verbose = this.options.verbose ? this.options.verbose : options.verbose;

  if (!options.silent) {
    let infoFn;
    let errFn;
    let warnFn;
    let debugFn;
    let startFn;
    let successFn;
    if (options.verbose) {
      infoFn = (msg) =>
        console.log(`${formatInfoMsg(msg, namespace)}`);
      errFn = (msg, err, data) =>
        console.log(`${formatErrorMsg(msg, namespace)}\n`, err.stack || err, data);
      warnFn = (msg) =>
        console.log(`${formatWarnMsg(msg, namespace)}`);
      debugFn = (msg) =>
        console.log(`${formatDebugMsg(msg, namespace)}`);
      startFn = (msg) =>
        console.log(`${formatStartMsg(msg, namespace)}`);
      successFn = (msg) =>
        console.log(`${formatSuccessMsg(msg, namespace)}`);
    } else {
      infoFn = (msg) => console.log(`${formatInfoMsg(msg, namespace)}`);
      errFn = (msg, err, data) => console.log(`${formatErrorMsg(msg, namespace)}`, err.stack || err, data);
      warnFn = (msg) => console.log(`${formatWarnMsg(msg, namespace)}`);
      // debugFn = (msg) => console.log(`${formatDebugMsg(msg, namespace)}`);
      debugFn = () => true;
      startFn = (msg) => console.log(`${formatStartMsg(msg, namespace)}`);
      successFn = (msg) => console.log(`${formatSuccessMsg(msg, namespace)}`);
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
    warn: () => true,
    debug: () => true,
    error: () => true,
    start: () => true,
    success: () => true,
    namespace: this.namespace.bind(this),
  };
};

module.exports = Logger;
