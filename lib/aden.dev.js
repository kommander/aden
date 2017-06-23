'use strict';

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const cannot = require('brokens');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');

function devWatch(rootPath) {
  this.watcher = chokidar.watch(rootPath, {
    recursive: true,
    persistent: true,
    depth: 10,
    ignored: /node_modules|\.dist/,
    ignoreInitial: true,
    awaitWriteFinish: true,
  });

  this.watcher.on('all', this.devWatchListenerBound);

  this.watcher.on('error', (err) => this.log.error('FSWatcher', err));
}

function devWatchListener(event, filePath) {
  const filename = path.relative(this.rootPath, filePath);

  // TODO: Get the page for the path and apply filters and options in page scope (?)
  const filterMatches = this.rootPage.noWatch.filter((value) => filename.match(value));
  if (filterMatches.length !== 0 || this.shutdownInProgress) {
    return;
  }

  clearTimeout(this.devWatchTimeout);

  this.log.info(`App path changed at ${filename} (${event})`);

  // Needs to be on _this_ bc. of the timeout that could put a non-rename in between,
  // then the re-build would ignore the rename event
  this.wasRenameEvent = this.wasRenameEvent
    || event === 'rename'
    || event === 'delete'
    || event === 'add'
    || event === 'unlink'
    || event === 'unlinkDir'
    || this.settings.dotFile.includes(filename);

  this.wasCustomFileEvent = this.watchKeys
    .find((key) => (key.value === filename));

  // TODO: When custom page extensions (.get.js, .data.js etc.) changed
  //       >> Reload them aka parse again
  //       >> but do not re-compile webpack (this.wasRenameEvent = true)

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    if (!this.wasRenameEvent && !this.wasCustomFileEvent) {
      this.compile(this.webpackConfigs)
        .then(() => this.log.event('dev:rebuild:done'))
        .catch((err) => {
          this.log.info('DEV Compile error', err);
          // ignore
        });
      return;
    }

    // Reset
    this.wasRenameEvent = false;
    this.wasCustomFileEvent = false;

    this.log.info('Re-parsing page tree');

    // TODO: ensure to clear modules cache before reloading

    // When a file was created/deleted, this.wasRenameEvent === true
    // In this case we currently parse the complete page tree again and setup
    // -> Can be optimised to only parse the page where a file was changed
    //    that need an actual re-parse. For now this should be ok for dev.
    // -> When a folder was deleted, check for removed entry points,
    //    remove them from the webpack config and rebuild without reparsing,
    //    -> Remove the affected page routers only
    //    (or set them to (req, res, next) => next() if wrapped)

    this.parseGraphs([this.rootPage])
      .then(() => this.postParseLoadSetup(this.pages))
      .then(({ pages }) => this.generateWebpackConfig(pages))
      .then(({ pages, webpackConfigs }) => {
        this.log.info('Rename: creating new compiler instance with updated config');

        try {
          this.log.info('Setting up new dev compiler after file change');
          this.compiler = webpack(webpackConfigs);
          this.compiler.plugin('compile', this.hotCompileCb);
          this.compiler.plugin('done', this.hotDoneCb);
        } catch (e) {
          this.log.error('Dev Compiler creation Error:', e);
        }

        return { pages, webpackConfigs };
      })
      .then(({ pages, webpackConfigs }) => this.build(pages, webpackConfigs))
      // Update routes on express app
      .then(({ pages }) => {
        // TODO: Check if page was removed and update this.pages
        // TODO: Track page route changes and only update
        const newRouter = express.Router({ // eslint-disable-line
          mergeParams: true,
        });

        return this.setupRoutes(newRouter, pages);
      })
      .then(({ router }) => {
        this.router = router;

        if (!this.shutdownInProgress) {
          this.log.event('dev:reload:done');
        }
      })
      .catch((err) => {
        this.log.warn('DevWatch build failed', err.stack);
      });
  }, 100);
}

function setupDev(pages, webpackConfigs) {
  return Promise.resolve().then(() => {
    if (!this.isDEV) {
      throw cannot('setup', 'dev')
        .because('running in production env');
    }

    if (!this.compiler) {
      // TODO: use a try/catch wrapper function to create a compiler instance
      this.compiler = webpack(webpackConfigs);
    }

    this.devHotMiddleware = webpackHotMiddleware({
      plugin: (evt, cb) => {
        if (evt === 'compile') {
          this.hotCompileCb = cb;
          this.compiler.plugin(evt, cb);
        } else if (evt === 'done') {
          const stubbedCallback = (stats) => {
            if (!this.nextCompilationScheduled) {
              cb(stats);
            }
          };
          this.hotDoneCb = stubbedCallback;
          this.compiler.plugin(evt, stubbedCallback);
        }
      },
    }, {
      path: `${pages[0].basePath}${this.settings.hmrPath}`,
      log: this.log.info.bind(this.log),
    });

    // Watch pages/layout/shared an poke compiler to run again
    // >> When new files and folders are created that it doesn't watch yet
    // >> rebuild webpackConfig
    this.devWatchListenerBound = this.devWatchListener.bind(this);
    this.devWatch(this.rootPath);

    return { pages };
  });
}

module.exports = {
  devWatch,
  devWatchListener,
  setupDev,
};
