'use strict';

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const cannot = require('brokens');
const fs = require('fs');
const _ = require('lodash');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const webpackDevMiddleware = require('webpack-dev-middleware');
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');

const AdenWatchFileSystem = require('./webpack/AdenWatchFileSystem');

const {
  ENTRY_STATIC,
  ENTRY_DYNAMIC,
  KEY_FILE,
  KEY_FILE_ARRAY,
  KEY_RPATH,
} = require('./aden.constants');

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

  if (event === 'unlinkDir') {
    const removedPage = this.pages.find((page) =>
      (page.relativePath === filename)
    )
    if (removedPage) {
      this.pagesToBeRemoved.push(removedPage);
    }
  }

  // TODO: When custom page extensions (.get.js, .data.js etc.) changed
  //       >> Reload them aka parse again
  //       >> but do not re-compile webpack (this.wasRenameEvent = true)

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    console.log('DEV WATCH TIMEOUT');
    // if (
    //   !this.wasRenameEvent 
    //   && !this.wasCustomFileEvent
    // ) {
    //   this.compile(this.webpackConfigs)
    //     .then(() => this.log.event('dev:rebuild:done'))
    //     .catch((err) => {
    //       this.log.info('DEV Compile error', err);
    //       // ignore
    //     });
    //   return;
    // }

    // // Reset
    // this.wasRenameEvent = false;
    // this.wasCustomFileEvent = false;

    // // TODO: ensure to clear modules cache before reloading

    // // When a file was created/deleted, this.wasRenameEvent === true
    // // In this case we currently parse the complete page tree again and setup
    // // -> Can be optimised to only parse the page where a file was changed
    // //    that need an actual re-parse. For now this should be ok for dev.
    // // -> When a folder was deleted, check for removed entry points,
    // //    remove them from the webpack config and rebuild without reparsing,
    // //    -> Remove the affected page routers only
    // //    (or set them to (req, res, next) => next() if wrapped)

    // Promise.resolve()
    //   .then(() => {
    //     if (this.pagesToBeRemoved.length > 0) {
    //       const removals = this.pagesToBeRemoved
    //         .map((page) => this.removePage(page));
    //       this.pagesToBeRemoved = [];
    //       return Promise.all(removals);
    //     }
    //   })
    //   .then(() => {
    //     this.log.info('Re-parsing page tree');
    //     return this.parseGraphs([this.rootPage]);
    //   })
    //   .then(() => this.postParseLoadSetup(this.pages))
    //   .then(({ pages }) => this.generateWebpackConfig(pages))
    //   .then(({ pages, webpackConfigs }) => {
    //     this.log.info('Rename: creating new compiler instance with updated config');

    //     try {
    //       this.log.info('Setting up new dev compiler after file change');
    //       this.compiler = webpack(webpackConfigs);
    //       this.compiler.plugin('compile', this.hotCompileCb);
    //       this.compiler.plugin('done', this.hotDoneCb);
    //     } catch (e) {
    //       this.log.error('Dev Compiler creation Error:', e);
    //     }

    //     return { pages, webpackConfigs };
    //   })
    //   .then(({ pages, webpackConfigs }) => this.build(pages, webpackConfigs))
    //   // Update routes on express app
    //   .then(({ pages }) => {
    //     // TODO: Check if page was removed and update this.pages
    //     // TODO: Track page route changes and only update
    //     const newRouter = express.Router({ // eslint-disable-line
    //       mergeParams: true,
    //     });

    //     return this.setupRoutes(newRouter, pages);
    //   })
    //   .then(({ router }) => {
    //     this.router = router;

    //     if (!this.shutdownInProgress) {
    //       this.log.event('dev:reload:done');
    //     }
    //   })
    //   .catch((err) => {
    //     this.log.error('DevWatch build failed', err);
    //   });
  }, 100);
}

function setupDev(pages, webpackConfigs) {
  return Promise.resolve().then(() => new Promise((resolve) => {
    if (!this.isDEV) {
      throw cannot('setup', 'dev')
        .because('running in production env');
    }

    const frontendConfig = webpackConfigs
        .find((conf) => (conf.name === 'frontend'));

    frontendConfig.plugins.unshift(new webpack.WatchIgnorePlugin([
      /node_modules/,
      /\.dist/,
    ]));

    frontendConfig.plugins.push(new HotModuleReplacementPlugin());
    frontendConfig.plugins.push(new HtmlWebpackHarddiskPlugin({
      outputPath: frontendConfig.output.path,
    }));

    Object.assign(frontendConfig.output, {
      hotUpdateChunkFilename: '[hash].chunk.hot-update.js',
      hotUpdateMainFilename: '[hash].hot-update.json',
    });

    let needReload = false;
    let initialBuild = true;
    
    webpackConfigs.forEach((config) => config.plugins.push({
      apply: (compiler) => {
        Object.assign(compiler, {
          watchFileSystem: new AdenWatchFileSystem(this, compiler.inputFileSystem),
        });

        compiler.plugin('compilation', (compilation) => {
          // force page reload when html-webpack-plugin template changes
          // -> https://github.com/vuejs-templates/webpack/blob/master/template/build/dev-server.js#L37-L43
          compilation.plugin('html-webpack-plugin-after-emit', (data, cb) => {
            console.log('RELOAD');
            needReload = true;
            cb();
          });
        });
      },
    }));

    if (!this.compiler) {
      this.compiler = webpack(webpackConfigs);
    }

    this.devHotMiddleware = webpackHotMiddleware(
    // {
    //   plugin: (evt, cb) => {
    //     console.log('plgin', evt);
    //     if (evt === 'compile') {
    //       this.hotCompileCb = cb;
    //       this.compiler.plugin(evt, cb);
    //     } else if (evt === 'done') {
    //       const stubbedCallback = (stats) => cb(stats);
    //       this.hotDoneCb = stubbedCallback;
    //       this.compiler.plugin(evt, stubbedCallback);
    //     }
    //   },
    // }, 
    this.compiler,
    {
      path: '/__webpack_hmr', // `${pages[0].basePath}${this.settings.hmrPath}`,
      log: this.log.info.bind(this.log),
      heartbeat: 2000,
    });

    // this.devMiddleware = webpackDevMiddleware(this.compiler, {
    //   hot: true,
    //   publicPath: frontendConfig.output.publicPath,
    //   stats: {
    //     colors: true,
    //   },
    //   historyApiFallback: true,
    //   watchOptions: {
    //     recursive: true,
    //     persistent: true,
    //     depth: 10,
    //     ignored: /node_modules|\.dist/,
    //     ignoreInitial: true,
    //     awaitWriteFinish: true,
    //   },
    // });

    // this.app.use(this.devMiddleware);

    this.app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });

    // this.fileSystem = this.devMiddleware.fileSystem;
    this.watcher = this.compiler.watch({
      recursive: true,
      persistent: true,
      depth: 10,
      ignored: /node_modules|\.dist/,
      ignoreInitial: true,
      awaitWriteFinish: true,
      aggregateTimeout: 2000,
    }, (err, stats) => {
      if (!this.shutdownInProgress) {
        if (needReload) {
          this.devHotMiddleware.publish({ action: 'reload' });
          needReload = false;
        }
        console.log('WATCH', stats.stats.length, stats.stats.map((stat) => stat.compilation.name));
        if (initialBuild) {
          initialBuild = false;
          if (err) {
            this.log.event('webpack:build:errors');
            reject(err);
          } else {
            resolve({ pages });
          }
        } else {
          const configNames = stats.stats.map((stat) => stat.compilation.name);
          if (err) {
            this.log.event('webpack:build:errors');
          } else if (configNames.includes('frontend')) {
            console.log('dev:reload:done');
            this.log.event('dev:reload:done');
          }
          console.log('IIIIIIII', this.invalidations);
          if (this.invalidations) {
            const invalid = _.uniq(this.invalidations
              .filter((pair) => configNames.includes(pair.left) 
                && !configNames.includes(pair.right)
              )
              .map((pair) => pair.right)
            );
            
            const watchings = this.watcher.watchings.filter((watching) => 
              invalid.includes(watching.compiler.name)
            );

            watchings.forEach((watching) => watching.invalidate());
          }
        }
      }
    });

    this.compiler.plugin('invalid', (fileName, changeTime) => {
      console.log('INVALID', fileName, changeTime);
    });
  }));
}

// Workaround to allow controlled building of multi watches
function invalidate(left, right) {
  this.invalidations = (this.invalidations || []).concat([{ left, right }]);
  console.log('INVALiDAtE', left, right, this.invalidations);
}

module.exports = {
  devWatch,
  devWatchListener,
  setupDev,
  invalidate,
};
