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

// NOTE: Use with care, needs refinement
// based on https://stackoverflow.com/questions/11616630/json-stringify-avoid-typeerror-converting-circular-structure-to-json
const stringify = (obj) => {
  const cache = [];
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return undefined;
      }
      cache.push(value);
    }
    return value;
  });
};

// TODO: Do not color code in production
// TODO: Reduce this mess
const formatInfoMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray(symbol.info)} ${chalk.gray(namespace)} ${jsonString}`;

const formatDebugMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.gray(symbol.debug)} ${chalk.gray(namespace)} ${chalk.gray(jsonString)}`;

const formatErrorMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.red(symbol.error)} ${chalk.red.bold(namespace)} ${jsonString}`;

const formatWarnMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.yellow(symbol.warn)} ${chalk.yellow.bold(namespace)} ${chalk.bold(jsonString)}`;

const formatStartMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.blue(symbol.start)} ${chalk.blue.bold(namespace)} ${jsonString}`;

const formatSuccessMsg = (jsonString, namespace) =>
  `[${chalk.gray(process.pid)}] ${chalk.green(symbol.success)} ${chalk.green.bold(namespace)} ${jsonString}`;

// TODO: add `once()` and `sometimes` notice methods, to inform, but not flood in dev
function Logger(opts = {}) {
  if (!(this instanceof Logger)) {
    return new Logger(opts);
  }
  this.options = opts;
}

function maybeEmpty(stuff) {
  return stuff ? stuff : undefined;
}
function maybeError(err) {
  return err ? err.stack || err : undefined;
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

  const stdStream = (string) => options.stdStream.write(`${string}\n`);
  const errStream = (string) => options.errStream.write(`${string}\n`);

  if (process.env.ADEN_FORCE_LOG === 'true') {
    Object.assign(options, {
      silent: false,
    });
  }

  const formatJson = (obj) => {
    return stringify(obj);
  };

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
        stdStream(applyDate(formatInfoMsg(formatJson({ msg }), name)));
      errFn = (msg, err, data) =>
        errStream(
          applyDate(formatErrorMsg(formatJson({
            msg,
            err: maybeError(err),
            data: maybeEmpty(data),
          }), name))
        );
      warnFn = (msg, data) =>
        stdStream(
          applyDate(formatWarnMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        );
      debugFn = (msg, data) =>
        stdStream(
          applyDate(formatDebugMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        );
      startFn = (msg, data) =>
        stdStream(
          applyDate(formatStartMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        );
      successFn = (msg, data) =>
        stdStream(
          applyDate(formatSuccessMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        );
    } else {
      infoFn = (msg) =>
        stdStream(applyDate(formatInfoMsg(formatJson({ msg }), name)));
      errFn = options.debug
        ? (msg, err, data) => errStream(
          applyDate(formatErrorMsg(formatJson({
            msg,
            err: maybeError(err),
            data: maybeEmpty(data),
          }), name))
        )
        : (msg, err) => errStream(
          applyDate(formatErrorMsg(formatJson({
            msg,
            err: maybeError(err),
          }), name))
        );
      warnFn = (msg, data) =>
        stdStream(
          applyDate(formatWarnMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        );
      debugFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatDebugMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        )
        : () => true;
      startFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatStartMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        )
        : (msg) => stdStream(applyDate(formatStartMsg(formatJson({
            msg,
          }), name)));
      successFn = options.debug
        ? (msg, data) => stdStream(
          applyDate(formatSuccessMsg(formatJson({
            msg,
            data: maybeEmpty(data),
          }), name))
        )
        : (msg) => stdStream(applyDate(formatSuccessMsg(formatJson({
            msg,
          }), name)));
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
        applyDate(formatInfoMsg(formatJson({
          msg,
          data: maybeEmpty(data),
        }), name))
      )
      : () => true,
    debug: () => true,
    error: options.debug
      ? (msg, err, data) => errStream(
        applyDate(formatErrorMsg(formatJson({
          msg,
          err: maybeError(err),
          data: maybeEmpty(data),
        }), name))
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
    lines.forEach((line) => {
      const lineType = getLineEventType(line);

      if (lineType) {
        const symbolRegex = new RegExp(symbol[lineType]);
        const jsonString = line.split(symbolRegex)[1].replace(/^ [ a-zA-Z0-9\/-_]{1,32} ({)/, '$1');
        const jsonData = JSON.parse(jsonString);

        if (lineType === 'success') {
          if (jsonData.msg.match(/started/i)) {
            this.emit('listening', jsonData.msg);
          }
          if (jsonData.msg.match(/started server|workers listening/i)) {
            this.emit('ready');
          }
        } else if (lineType === 'info') {
          if (jsonData.msg.match(/worker exit normal/i)) {
            this.emit('worker:shutdown');
          }
          if (jsonData.msg.match(/no workers left/i)) {
            this.emit('shutdown:complete');
          }
        } else if (lineType === 'error') {
          // TODO: Needs to handle non-error stack json data
          const errLines = jsonData.err.split('\n');
          const parts = errLines[0].split(': ');
          const name = parts[0];
          const errMessage = parts.slice(1).join(': ');
          const err = new Error(errMessage);
          err.name = name;
          err.stack = errLines;

          if (this.listeners('error').length > 0) {
            this.emit('error', err);
          }
          if (err.message.match(/Worker error code/i)) {
            this.emit('worker:error', err);
          }
        }
      }
    });
  };
};

Logger.getLogParser = () => new LogParser();

module.exports = Logger;
