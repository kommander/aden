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
    this.watchFifoPipe = [];
    this.fsFifoPipe = [];

    this.options = Object.assign({
      aggregateTimeout: 300,
      ignored: /node_modules|\.dist/,
      depth: 10,
    }, options);

    // Not overwritable
    Object.assign(this.options, {
      recursive: true,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true,
    });

    this._watcher = chokidar.watch(this.aden.rootPath, this.options);

    this._watcher.on('ready', this.onReady.bind(this));
    this._watcher.on('error', this.onError.bind(this));

    this._go();
  }

  onReady() {
    this._watcher.on('all', this.allHandler.bind(this));
    this._watcher.on('change', this.change.bind(this));
    this.emit('ready');
  }

  onError(err) {
    this.aden.log.error('FSWatcher', err);
    this.emit('error', err);
  }

  _go() {
    clearTimeout(this.aggregateTimeout);
    // TODO: increase aggregation timeout by a factor for file add/rename
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
        mtime: evt.stat ? +evt.stat.mtime : Date.now(),
      }));

    const removals = _.uniq(
      events
        .filter((evt) => ['unlink', 'unlinkDir', 'delete'].includes(evt.type))
        .map((evt) => evt.filePath)
    );

    const changes = _.uniq(
      events
        .map((evt) => evt.filePath)
        .filter((filePath) => !removals.includes(filePath))
    );

    if (this.inputFileSystem && this.inputFileSystem.purge) {
      this.inputFileSystem.purge(changes);
    }

    const added = _.uniq(events.filter((evt) => ['add', 'addDir'].includes(evt.type))
      .map((evt) => evt.filePath));
    
    const watchers = _.uniq(
      events
        .filter((evt) => !removals.includes(evt.filePath))
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

    if (added.length > 0 || removals.length > 0) {
      this.emit('hardChanges', added, removals);
    }

    watchers
      .map((watcher) => watcher.callback)
      .filter((cb) => !!cb)
      .forEach((cb) => cb(
        null,
        changes, // files
        [], // dirs - not implemented yet
        removals,
        this.times,
        added
      ));

    return Promise.resolve();
  }

  addFileHandler(file, mtime) {
    const fileHandler = {
      watchers: [],
      mtime: mtime || Date.now(),
    };
    this.files[file] = fileHandler;
    this._watcher.add(file);
    return fileHandler;
  }

  watch(files, dirs = [], missing, startTime, options, callback, callbackUndelayed) {
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

    if (dirs.length > 0) {
      this.aden.log.warn('Trying to watch dirs... not implemented yet.');
    }

    files.map((file) => {
      let fileHandler = this.files[file];
      if (!fileHandler) {
        fileHandler = this.addFileHandler(file);
      }

      fileHandler.watchers.push(watcher);

      return watcher;
    });

    this.watchFifoPipe.push(watcher);
    
    // FSWatcher like instance .close/.pause
    return {
      close: () => {
        this.watchers.splice(this.watchers.indexOf(watcher), 1);
        if (this.watchers.length === 0) {
          clearTimeout(this.aggregateTimeout);
          this._watcher && this._watcher.close() && (this._watcher = null);
        }
      },
      pause: () => {
        console.log('fs watch pause not implemented yet');
      },
      resume: () => {
        console.log('fs watch resume not implemented yet');
      },
    }
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

  allHandler(type, filePath, stat) {
    let fileHandler = this.files[filePath];
    
    if (!fileHandler && [
      'rename', 'add', 'addDir', 
      'unlinkDir', 'unlink', 'delete'
    ].includes(type)) {
      fileHandler = this.addFileHandler(filePath);
    }

    if (fileHandler) {
      this._go();

      this.fsFifoPipe.push({
        type, filePath, stat, fileHandler,
      });
    }
  }

  purge() {
    if (this.inputFileSystem) {
      this.inputFileSystem.purge();
    }
    this.watchers = [];
    this.files = {};
    this.times = {};
    this.watchFifoPipe = [];
    this.fsFifoPipe = [];
    this._go();
  }
}

module.exports = AdenWatchFileSystem;
