/* eslint-disable max-len, no-console */

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const chalk = require('chalk');
const moment = require('moment');
const _ = require('lodash');

const logDateFormat = 'YYYY-MM-DD hh:mm:ss.SSS';

const symbol = {
  info: '\u272A',
  debug: '\u22C5',
  error: '\u2717',
  warn: '\u26A0',
  start: '\u2023',
  success: '\u2713',
};

// TODO: Do not color code in production
const formatInfoMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray(symbol.info)} ${chalk.gray(namespace)} ${msg}`;

const formatDebugMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray(symbol.debug)} ${chalk.gray(namespace)} ${chalk.gray(msg)}`;

const formatErrorMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.red(symbol.error)} ${chalk.red.bold(namespace)} ${msg}`;

const formatWarnMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.yellow(symbol.warn)} ${chalk.yellow.bold(namespace)} ${chalk.bold(msg)}`;

const formatStartMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.blue(symbol.start)} ${chalk.blue.bold(namespace)} ${msg}`;

const formatSuccessMsg = (msg, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.green(symbol.success)} ${chalk.green.bold(namespace)} ${msg}`;

// TODO: add `once()` and `sometimes` notice methods, to inform, but not flood in dev
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

function LogParser() {
  this.streams = [];
}
util.inherits(LogParser, EventEmitter);

const symbolKeys = Object.keys(symbol);
const symbols = symbolKeys.map((k) => symbol[k]);
const symbolToName = symbolKeys.reduce((prev, k) =>
  Object.assign(prev, { [symbol[k]]: k })
, {});
const typeRegex = new RegExp(`(${symbols.join('|')})`);

function getLineEventType(line) {
  const result = line.match(typeRegex);
  if (result) {
    return symbolToName[result[0]];
  }
  return null;
}

LogParser.prototype.attach = function attach(readStream) {
  const handler = this.getStreamHandler();
  this.streams.push({ handler, readStream });
  readStream.on('data', handler);
};

LogParser.prototype.detach = function detach(readStream) {
  const index = this.streams.findIndex((item) => (item.readStream === readStream));
  readStream.removeListener('data', this.streams[index].handler);
  this.streams.splice(index, 1);
};

LogParser.prototype.destroy = function destroy() {
  this.streams.forEach((item) => this.detach(item.readStream));
};

LogParser.prototype.getStreamHandler = function getStreamHandler() {
  let buf = null;
  return (data) => {
    let stringBuffer = data.toString('utf8');
    if (buf) {
      stringBuffer = buf + stringBuffer;
      buf = null;
    }
    const lines = stringBuffer.split('\n');
    if (data[data.length - 1] !== '\n') {
      buf = lines.pop();
    }
    lines.forEach((line, index) => {
      const lineType = getLineEventType(line);
      console.log(line);
      if (lineType) {
        if (lineType === 'success') {
          if (line.match(/started/i)) {
            this.emit('listening', line);
          }
          if (line.match(/started server|workers listening/i)) {
            this.emit('ready');
          }
        } else if (lineType === 'info') {
          if (line.match(/worker exit normal/i)) {
            this.emit('worker:shutdown');
          }
          if (line.match(/no workers left/i)) {
            this.emit('shutdown:complete');
          }
        } else if (lineType === 'error') {
          if (line.match(/Worker Exit with Error/i)) {
            this.emit('worker:error');
          }
          // TODO: Parse correct error stack
          const lineParts = line.split(': ');
          lineParts.shift();
          const slice = lines.slice(index + 1);
          const endOfStack = slice.findIndex((stackLine) => getLineEventType(stackLine));
          const stackLines = slice.slice(0, endOfStack);
          const stack = [lineParts.join(': ')].concat(stackLines).join('\n');

          const err = new Error(lineParts[1]);
          err.stack = stack;
          err.name = lineParts[0] || 'Error';
          this.emit('error', err);
        }
      }
    });
  };
};

Logger.getLogParser = () => new LogParser();

module.exports = Logger;
