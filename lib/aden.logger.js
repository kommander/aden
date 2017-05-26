/* eslint-disable max-len, no-console */

const EventEmitter = require('events').EventEmitter;
const util = require('util');
const chalk = require('chalk');
const moment = require('moment');
const _ = require('lodash');

const logDateFormat = 'YYYY-MM-DD hh:mm:ss.SSS';

const symbol = {
  raw: '\u26AC',
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

  if (typeof obj === 'object') {
    if (obj.data === null) {
      Object.assign(obj, { data: undefined });
    }
    if (obj.err === null) {
      Object.assign(obj, { err: undefined });
    }
  }

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

// TODO: add `once()` and `sometimes` notice methods, to inform, but not flood in dev
function Logger(opts = {}) {
  if (!(this instanceof Logger)) {
    return new Logger(opts);
  }
  this.options = opts;
}

function maybeError(err) {
  return err ? err.stack || err : undefined;
}

// TODO: allow --debug [namespace]
Logger.prototype.namespace = function namespace(name, opts = {}) {
  if (!name) throw new Error('need a name');

  const options = _.extend({
    silent: true,
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

  const applyDate = (msg) => {
    if (options.noDate) {
      return msg;
    }
    const date = chalk.cyan(moment().format(logDateFormat));
    return `${date} ${msg}`;
  };

  const fns = {
    raw: () => true,
    info: () => true,
    warn: () => true,
    debug: () => true,
    error: () => true,
    start: () => true,
    success: () => true,
    namespace: this.namespace.bind(this),
  };

  if (options.silent) {
    return fns;
  }

  // TODO: Do not color code in production
  // TODO: Reduce this mess
  const formatInfoMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.gray(symbol.info)} ${chalk.gray(name)} ${jsonString}`);

  const formatDebugMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.gray(symbol.debug)} ${chalk.gray(name)} ${chalk.gray(jsonString)}`);

  const formatErrorMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.red(symbol.error)} ${chalk.red.bold(name)} ${jsonString}`);

  const formatWarnMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.yellow(symbol.warn)} ${chalk.yellow.bold(name)} ${chalk.bold(jsonString)}`);

  const formatStartMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.blue(symbol.start)} ${chalk.blue.bold(name)} ${jsonString}`);

  const formatSuccessMsg = (jsonString) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.green(symbol.success)} ${chalk.green.bold(name)} ${jsonString}`);

  const formatRawMsg = (string) =>
    applyDate(`[${chalk.gray(process.pid)}] ${chalk.gray(symbol.raw)} ${chalk.green.bold(name)} ${chalk.gray(symbol.raw)} ${string}`);


  if (options.debug) {
    fns.debug = (msg, data) => stdStream(
      formatDebugMsg(stringify({
        msg,
        data,
      }))
    );
  }

  fns.info = (msg, data) => stdStream(
    formatInfoMsg(stringify({
      msg,
      data,
    }))
  );

  fns.warn = (msg, data) => stdStream(
    formatWarnMsg(stringify({
      msg,
      data,
    }))
  );

  fns.error = (msg, err, data) => errStream(
    formatErrorMsg(stringify({
      msg,
      err: maybeError(err),
      data,
    }))
  );

  fns.start = (msg, data) => stdStream(
    formatStartMsg(stringify({
      msg,
      data,
    }))
  );

  fns.success = (msg, data) => stdStream(
    formatSuccessMsg(stringify({
      msg,
      data,
    }))
  );

  fns.raw = (msg) => stdStream(
    formatRawMsg(msg)
  );

  return fns;
};

/**
 * The log message are an event stream with json data attached.
 * With the LogParser we can read the events from a stream
 * and emit the events with a parsed json data object.
 */
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

LogParser.prototype.parseLine = function parseLine(line, lineType) {
  const symbolRegex = new RegExp(symbol[lineType]);

  // Remove line color ansi escape codes (dev only)
  const result = line
    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

  if (lineType === 'raw') {
    return result.split(symbolRegex)[2].slice(1);
  }

  const jsonString = result.split(symbolRegex)[1]
    .replace(/^ [ a-zA-Z0-9\/-_]{1,32} ({)/, '$1');
  return JSON.parse(jsonString);
};

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
        const jsonData = this.parseLine(line, lineType);

        if (lineType === 'success') {
          this.emit('success', jsonData);
          if (jsonData.msg.match(/started/i)) {
            this.emit('listening', jsonData.msg);
          }
          if (jsonData.data && jsonData.data.event === 'ready') {
            this.emit('ready', jsonData.data);
          }
        } else if (lineType === 'info') {
          this.emit('info', jsonData);
          if (jsonData.msg.match(/worker exit normal/i)) {
            this.emit('worker:shutdown', jsonData);
          }
          if (jsonData.msg.match(/no workers left/i)) {
            this.emit('shutdown:complete', jsonData);
          }
        } else if (lineType === 'error') {
          let err;
          if (typeof jsonData.err === 'object') {
            err = jsonData.err;
          } else {
            const errLines = jsonData.err.split('\n');
            const parts = errLines[0].split(': ');
            const name = parts[0];
            const errMessage = parts.slice(1).join(': ');
            err = new Error(errMessage);
            err.name = name;
            err.stack = errLines;
          }

          if (this.listeners('error').length > 0) {
            this.emit('error', err, jsonData);
          }

          if (err.message && err.message.match(/Worker error code/i)) {
            this.emit('worker:error', err, jsonData);
          }
        } else {
          this.emit(lineType, jsonData);
        }
      }
    });
  };
};

Logger.getLogParser = () => new LogParser();

module.exports = Logger;
