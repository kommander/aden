'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');

function devWatch() {
  fs.watch(this.rootPage.path, { recursive: true }, this.devWatchListenerBound);
}

function devWatchListener(event, filename) {
  // TODO: Get the page for the path and apply filters and options in page scope
  const filterMatches = this.rootPage.noWatch.filter((value) => filename.match(value));
  if (filterMatches.length !== 0) {
    return;
  }

  clearTimeout(this.devWatchTimeout);

  this.logger.info(`App path changed at ${filename} (${event})`);

  this.wasRenameEvent = this.wasRenameEvent || event === 'rename' || filename === '.aden';

  // TODO: If .middleware changed, update page routers
  // TODO: When custom page extensions (.render.js, .template.js, .data.js etc.) changed
  //       >> Reload them aka parse again

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    if (!this.wasRenameEvent) {
      this.compile();
      return;
    }
    this.wasRenameEvent = false;

    // Reset default render to reload cached templates
    this.defaultRender = null;

    this.load(this.rootConfig.path)
      .then(() => {
        // TODO: Check if page was removed and update this.pages

        // TODO: Track page route changes and only update
        const newRouter = express.Router(); // eslint-disable-line
        this.setupRoutes(newRouter, [this.rootPage]);
        this.router = newRouter;

        // TODO: Only create a new compiler if entry points changed
        this.logger.info('Rename: creating new compiler instance with updated config');
        this.compiler = webpack(this.webpackConfig);
        this.compiler.plugin('compile', this.hotCompileCb);
        this.compiler.plugin('done', this.hotDoneCb);
      })
      .then(() => this.build())
      .then(() => {
        this.logger.info('Done handling changes', {
          entry: this.webpackConfig.entry,
        });
      })
      .catch((err) => {
        this.logger.warn('DevWatch build failed', {}, err);
      });
  }, 100);
}

function setupDev() {
  return Promise.resolve().then(() => {
    if (!this.compiler) {
      this.compiler = webpack(this.webpackConfig);
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
      path: this.hmrPath,
    });

    this.app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });

    // Watch pages/layout/shared an poke compiler to run again
    // >> When new files and folders are created that it doesn't watch yet
    // >> rebuild webpackConfig
    this.devWatchListenerBound = this.devWatchListener.bind(this);
    this.devWatch();
  });
}

module.exports = {
  devWatch,
  devWatchListener,
  setupDev,
};
