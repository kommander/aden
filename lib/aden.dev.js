'use strict';

const express = require('express');
const fs = require('fs');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');

function devWatch(rootPage) {
  this.watcher = fs.watch(rootPage.rootPath, {
    recursive: true,
    persistent: false,
  }, this.devWatchListenerBound);

  this.watcher.on('error', (err) => this.logger.error('FSWatcher', err));
}

function devWatchListener(event, filename) {
  // TODO: Get the page for the path and apply filters and options in page scope (?)
  const filterMatches = this.rootPage.noWatch.filter((value) => filename.match(value));
  if (filterMatches.length !== 0) {
    return;
  }

  clearTimeout(this.devWatchTimeout);

  this.logger.info(`App path changed at ${filename} (${event})`);

  // Needs to be on _this_ bc. of the timeout that could put a non-rename in between,
  // then the re-build would ignore the rename event
  this.wasRenameEvent = this.wasRenameEvent || event === 'rename'
    || this.config.dotFile.includes(filename);

  // TODO: Need to iterate over all page keys here, not registered keys
  this.wasCustomFileEvent = this.keys.find((key) => (key.value === filename));

  // TODO: When custom page extensions (.send.js, .template.js, .data.js etc.) changed
  //       >> Reload them aka parse again
  //       >> but do not re-compile webpack (this.wasRenameEvent = true)

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    if (!this.wasRenameEvent && !this.wasCustomFileEvent) {
      this.compile(this.webpackConfigs)
        .catch((err) => { // eslint-disable-line
          this.logger.info('DEV Compile error', err);
          // ignore
        });
      return;
    }

    // Reset
    this.wasRenameEvent = false;
    this.wasCustomFileEvent = false;

    this.loadPages(this.rootConfig)
      .then((pages) => this.setup(pages))
      .then(({ pages }) => {
        // TODO: Check if page was removed and update this.pages

        // TODO: Track page route changes and only update
        const newRouter = express.Router(); // eslint-disable-line
        this.setupRoutes(newRouter, [this.rootPage]);
        this.router = newRouter;

        this.logger.info('Rename: creating new compiler instance with updated config');
        try {
          this.compiler = webpack(this.webpackConfigs);
          this.compiler.plugin('compile', this.hotCompileCb);
          this.compiler.plugin('done', this.hotDoneCb);
        } catch (e) {
          this.logger.error('Dev Compiler Error:', e);
        }

        return { pages };
      })
      .then(({ pages }) => this.build(pages, this.webpackConfigs))
      .then(() => {
        this.logger.info('Done handling changes');
      })
      .catch((err) => {
        this.logger.warn('DevWatch build failed', err);
      });
  }, 100);
}

function setupDev(rootPage, webpackConfig) {
  return Promise.resolve().then(() => {
    if (!this.compiler) {
      // TODO: use a try/catch wrapper function to create a compiler instance
      this.compiler = webpack(webpackConfig);
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
      path: `${rootPage.basePath}${this.config.hmrPath}`,
    });

    // Watch pages/layout/shared an poke compiler to run again
    // >> When new files and folders are created that it doesn't watch yet
    // >> rebuild webpackConfig
    this.devWatchListenerBound = this.devWatchListener.bind(this);
    this.devWatch(rootPage);
  });
}

module.exports = {
  devWatch,
  devWatchListener,
  setupDev,
};
