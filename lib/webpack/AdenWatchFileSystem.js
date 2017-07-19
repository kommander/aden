const EventEmitter = require('events').EventEmitter;
const chokidar = require('chokidar');
const _ = require('lodash');

function withoutCase(str) {
  return str.toLowerCase();
}

class AdenWatchFileSystem extends EventEmitter {
  constructor(aden, inputFileSystem, options = {}) {
    super();

    this.inputFileSystem = inputFileSystem;

    this.aden = aden;
    this.watchers = [];
    this.files = {};
    this.times = {};

    this.options = Object.assign({
      aggregateTimeout: 300,
    }, options);

    this._watcher = chokidar.watch(withoutCase(this.aden.rootPath), {
      recursive: true,
      persistent: true,
      depth: 10,
      ignored: /node_modules|\.dist/,
      ignoreInitial: true,
      awaitWriteFinish: true,
    });

    this._watcher.on('all', this.listener.bind(this));
    this._watcher.on('change', this.change.bind(this));
    this._watcher.on('error', (err) => this.aden.log.error('FSWatcher', err));

    this.watchFifoPipe = [];
    this.fsFifoPipe = [];

    this._go();
  }

  close() {
    this._watcher.close();
  }

  _go() {
    clearTimeout(this.aggregateTimeout);
    this.aggregateTimeout = setTimeout(this.tick.bind(this), this.options.aggregateTimeout);
  }

  tick() {
    if (this.watchFifoPipe.length === 0 && this.fsFifoPipe.length === 0) {
      return this._go();
    }

    const watchSlice = this.watchFifoPipe;
    this.watchFifoPipe = [];

    const fsSlice = this.fsFifoPipe;
    this.fsFifoPipe = [];

    return this.applyWatchUpdates(watchSlice)
      .then(() => this.applyFSEvents(fsSlice))
      .then(() => this._go());
  }

  applyWatchUpdates(/* updates */) {
    return Promise.resolve();
  }

  applyFSEvents(events) {
    if (events.length === 0) {
      return Promise.resolve();
    }

    events
      .forEach((evt) => Object.assign(evt.fileHandler, {
        mtime: +evt.stat.mtime,
      }));

    const changes = _.uniq(
      events
        .map((evt) => evt.filePath)
    );

    if (this.inputFileSystem && this.inputFileSystem.purge) {
      this.inputFileSystem.purge(changes);
    }

    const removals = _.uniq(
      events
        .filter((evt) => ['unlink', 'unlinkDir', 'delete'].includes(evt.type))
        .map((evt) => evt.filePath)
    );

    const watchers = _.uniq(
      events
        .map((evt) => {
          const cbs = evt.fileHandler.watchers;
          Object.assign(evt.fileHandler, {
            watchers: [],
          });
          return cbs;
        })
        .reduce((prev, cbs) => prev.concat(cbs), [])
    );

    this.watchers = this.watchers.filter((watcher) => !watchers.includes(watcher));

    this.times = Object.keys(this.files)
      .reduce((prev, key) => Object.assign(prev, {
        [key]: this.files[key].mtime,
      }), {});

    watchers
      .map((watcher) => watcher.callback)
      .filter((cb) => !!cb)
      .forEach((cb) => cb(
        null,
        changes, // files
        [], // dirs - not implemented yet
        removals,
        this.times,
        this.times
      ));

    return Promise.resolve();
  }

  watch(files, dirs, missing, startTime, options, callback, callbackUndelayed) {
    const watchOptions = Object.assign({}, this.options);
    Object.assign(watchOptions, options);

    const watcher = {
      files,
      dirs,
      missing,
      startTime,
      callback,
      callbackUndelayed,
    };
    this.watchers.push(watcher);

    files.map((file) => {
      let fileHandler = this.files[file];
      if (!fileHandler) {
        fileHandler = {
          watchers: [],
          mtime: Date.now(),
        };
        this.files[file] = fileHandler;
        this._watcher.add(file);
      }

      fileHandler.watchers.push(watcher);

      return watcher;
    });

    this.watchFifoPipe.push(watcher);
    // TODO: return FSWatcher like instance .close/.pause
  }

  change(filePath, stat) {
    this.watchers
      .filter((watcher) => watcher.files.includes(filePath))
      .forEach((watcher) => {
        if (watcher.callbackUndelayed) {
          watcher.callbackUndelayed(filePath, +stat.mtime);
          Object.assign(watcher, {
            callbackUndelayed: null,
          });
        }
      });
  }

  listener(type, filePath, stat) {
    const fileHandler = this.files[filePath];

    if (fileHandler) {
      this._go();

      this.fsFifoPipe.push({
        type, filePath, stat, fileHandler,
      });
    }
  }
}

module.exports = AdenWatchFileSystem;
