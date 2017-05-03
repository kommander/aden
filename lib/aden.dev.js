'use strict';

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const cannot = require('cannot');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');

function devWatch(rootPage) {
  this.watcher = chokidar.watch(rootPage.rootPath, {
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
  const filename = path.relative(this.rootPage.rootPath, filePath);

  this.log.debug('FS Watch event', event, filePath, filename);

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
    || this.config.dotFile.includes(filename);

  this.wasCustomFileEvent = this.watchKeys
    .find((key) => (key.value === filename));

  // TODO: When custom page extensions (.send.js, .template.js, .data.js etc.) changed
  //       >> Reload them aka parse again
  //       >> but do not re-compile webpack (this.wasRenameEvent = true)

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    if (!this.wasRenameEvent && !this.wasCustomFileEvent) {
      this.compile(this.webpackConfigs)
        .then(() => this.emit('dev:rebuild:done'))
        .catch((err) => { // eslint-disable-line
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
    this.loadPages(this.rootConfig)
      .then((pages) => this.setup(pages))
      .then(({ pages }) => this.generateWebpackConfig(pages))
      .then(({ pages, webpackConfigs }) => {
        this.log.info('Rename: creating new compiler instance with updated config');

        try {
          this.compiler = webpack(webpackConfigs[0]);
          this.compiler.plugin('compile', this.hotCompileCb);
          this.compiler.plugin('done', this.hotDoneCb);
        } catch (e) {
          this.log.error('Dev Compiler Error:', e);
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

        this.setupRoutes(newRouter, pages);
        this.router = newRouter;
      })
      .then(() => {
        this.log.info('Done handling changes');
        if (!this.shutdownInProgress) {
          this.emit('dev:reload:done');
        }
      })
      .catch((err) => {
        this.log.warn('DevWatch build failed', err);
      });
  }, 100);
}

function setupDev(pages, webpackConfigs) {
  return Promise.resolve().then(() => {
    if (!this.isDEV || this.isPROD) {
      throw cannot('setup', 'dev')
        .because('running in production env');
    }

    if (!this.compiler) {
      // TODO: use a try/catch wrapper function to create a compiler instance
      this.compiler = webpack(webpackConfigs[0]);
    }

    this.devHotMiddleware = webpackHotMiddleware({
      plugin: (evt, cb) => {
        let stubbedCallback = null;
        if (evt === 'compile') {
          stubbedCallback = cb;
          this.hotCompileCb = stubbedCallback;
        } else if (evt === 'done') {
          stubbedCallback = (stats) => {
            if (!this.nextCompilationScheduled) {
              cb(stats);
            }
          };
          this.hotDoneCb = stubbedCallback;
        }
        this.compiler.plugin(evt, stubbedCallback);
      },
    }, {
      path: `${pages[0].basePath}${this.config.hmrPath}`,
      log: this.log.info.bind(this.log),
    });

    // Watch pages/layout/shared an poke compiler to run again
    // >> When new files and folders are created that it doesn't watch yet
    // >> rebuild webpackConfig
    this.devWatchListenerBound = this.devWatchListener.bind(this);
    this.devWatch(pages[0]);

    return { pages };
  });
}

module.exports = {
  devWatch,
  devWatchListener,
  setupDev,
};
