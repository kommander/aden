const EventEmitter = require('events').EventEmitter;
const chokidar = require('chokidar');
const _ = require('lodash');

function withoutCase(str) {
  return str.toLowerCase();
}

// callbackUndelayed [ '/aden/test/tmpdata/layoutdev/index.html', 1500397481000 ]
// aggregated [ '/aden/test/tmpdata/layoutdev/index.html' ] [] { '/aden/attitudes/statuspages/404/.aden.js': 1497780986000,
//   '/aden/attitudes/statuspages/404/index.html': 1497780986000,
//   '/aden/attitudes/statuspages/500/.aden.js': 1497780986000,
//   '/aden/attitudes/statuspages/500/index.hbs': 1498054854000,
//   '/aden/lib/client/dev.js': 1500380235000,
//   '/aden/lib/client/index.js': 1495395866000,
//   '/aden/test/tmpdata/layoutdev/.server': 1500397483000,
//   '/aden/test/tmpdata/layoutdev/index.html': 1500397483000,
//   '/aden/test/tmpdata/layoutdev/layout.default.html': 1500397487000 } [ '/aden/test/tmpdata/layoutdev/index.html' ]
// aggregated [ '/aden/test/tmpdata/layoutdev/layout.default.html' ] [] { '/aden/test/tmpdata/layoutdev/.server': 1500397483000,
//   '/aden/test/tmpdata/layoutdev/index.html': 1500397483000,
//   '/aden/test/tmpdata/layoutdev/layout.default.html': 1500397487000 } [ '/aden/test/tmpdata/layoutdev/layout.default.html' ]

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

  applyWatchUpdates(updates) {
    console.log('applyWatchUpdates', updates);
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

    if(this.inputFileSystem && this.inputFileSystem.purge) {
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
        [key]: Date.now() + 10000. // this.files[key].mtime,
      }), {});

    console.log('CALLBACKS', watchers.length)

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

    console.log('Apply FS Event', changes, this.times);
    
    return Promise.resolve();
  }

  watch(files, dirs, missing, startTime, options, callback, callbackUndelayed) {
    console.log('AdenWatchFileSystem.watch called', {
      files, dirs, missing, startTime, options, callback, callbackUndelayed,
    });

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
  }

  change(filePath, stat) {
    console.log('CHANGE', filePath, this.watchers.length);
    this.watchers
      .filter((watcher) => {
        console.log('INCLUDES', watcher.files)
        return watcher.files.includes(filePath)
      })
      .forEach((watcher) => {
        if (watcher.callbackUndelayed) {
          console.log('CHANAAAGE, callbackUndelayed', filePath, stat);
          watcher.callbackUndelayed(filePath, +stat.mtime);
          Object.assign(watcher, {
            callbackUndelayed: null,
          });
        }
      });
  }

  listener(type, filePath, stat) {
    const fileHandler = this.files[filePath];
    console.log('CHOKIDAR', type, filePath, fileHandler, stat);
    
    if (fileHandler) {
      this._go();  

      this.fsFifoPipe.push({
        type, filePath, stat, fileHandler,
      });
    }
  }
}

module.exports = AdenWatchFileSystem;