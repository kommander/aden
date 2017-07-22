'use strict';

const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const cannot = require('brokens');
const fs = require('fs');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

const webpack = require('webpack');
const webpackHotMiddleware = require('webpack-hot-middleware');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const webpackDevMiddleware = require('webpack-dev-middleware');
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin');
const MultiCompiler = require("webpack/lib/MultiCompiler");
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");
const AdenWatchFileSystem = require('./webpack/AdenWatchFileSystem');

const {
  ENTRY_STATIC,
  ENTRY_DYNAMIC,
  KEY_FILE,
  KEY_FILE_ARRAY,
  KEY_RPATH,
} = require('./aden.constants');

function applyDevConfig(pages, webpackConfigs) {
  const frontendConfig = webpackConfigs
    .find((conf) => (conf.name === 'frontend'));

  frontendConfig.plugins.push(new HotModuleReplacementPlugin());
  frontendConfig.plugins.push(new HtmlWebpackHarddiskPlugin({
    outputPath: frontendConfig.output.path,
  }));

  Object.assign(frontendConfig.output, {
    hotUpdateChunkFilename: '[hash].chunk.hot-update.js',
    hotUpdateMainFilename: '[hash].hot-update.json',
  });

  webpackConfigs.forEach((config) => config.plugins.unshift(new webpack.WatchIgnorePlugin([
    /node_modules/,
    /\.dist/,
  ])));

  const state = {
    needReload: false,
  };
      
  webpackConfigs.forEach((config) => config.plugins.push({
    apply: (compiler) => {
      compiler.plugin('compilation', (compilation) => {
        // force page reload when html-webpack-plugin template changes
        // -> https://github.com/vuejs-templates/webpack/blob/master/template/build/dev-server.js#L37-L43
        compilation.plugin('html-webpack-plugin-after-emit', (data, cb) => {
          state.needReload = true;
          cb();
        });
      });
    },
  }));

  frontendConfig.plugins.push({
    apply: (compiler) => {
       compiler.plugin('done', () => {
        if (state.needReload) {
          this.devHotMiddleware.publish({ action: 'reload' });
          state.needReload = false;
        }
      });
    },
  });
}

function devRebuild(pages) {
  return this.parseGraphs(pages)
    .then(() => this.postParseLoadSetup(this.pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfigs }) => {
      if (webpackConfigs.length > 0) {
        this.log.info('Creating new compiler instance with updated config');
        
        this.watchFileSystem.purge();

        this.applyDevConfig(pages, webpackConfigs);
        this.compiler = webpack(webpackConfigs); 

        if (!this.watcher) {
          this.startWatcher();
        }
        
        this.compiler.plugin('compile', this.hotCompileCb);   
        this.compiler.plugin('done', this.hotDoneCb);

        this.compiler.compilers.forEach((compiler) => Object.assign(compiler, {
          watchFileSystem: this.watchFileSystem,
        }));

        Object.assign(this.watcher, {
          compiler: this.compiler,
        });

        this.watcher.watchings.forEach((watching, index) => {
          // watching.close(); // needs to be checked if needed
          Object.assign(watching, {
            compiler: this.compiler.compilers[index],
          });
        });

        this.watcher.watchings.forEach((watching) => {
          watching.compiler.readRecords((err) => {
            if(err) return watching._done(err);
            watching._go();
          });
        });
      }

      this.router = express.Router({
        mergeParams: true,
      });

      return this.setupRoutes(this.router, pages)
        .then(() => {
          if (webpackConfigs.length === 0) {
            this.log.event('dev:reload:done');
          }
        });
    });
}

function startWatcher(cb) {
  let initialBuild = true;
  this.watcher = this.compiler.watch({
    ignored: /node_modules|\.dist/,
  }, (err, stats) => {
    if (!this.shutdownInProgress) {
      const jsonStats = stats.toJson();

      if (jsonStats.errors.length > 0) {
        this.log.error('webpack:build', jsonStats.errors);
      }

      if (!initialBuild) {
        const configNames = stats.stats.map((stat) => stat.compilation.name);
        if (configNames.includes('frontend')) {
          this.log.event('dev:reload:done');
        }
        
        if (this.invalidations) {
          const invalid = _.uniq(this.invalidations
            .filter((pair) => configNames.includes(pair.left) 
              && !configNames.includes(pair.right)
            )
            .map((pair) => pair.right)
          );
          
          if (invalid.length > 0) {
            const watchings = this.watcher.watchings.filter((watching) => 
              invalid.includes(watching.compiler.name)
            );

            this.log.info(`Invalidating ${invalid}`);

            watchings.forEach((watching) => watching.invalidate());
          }
        }
      } else {
        initialBuild = false;
        if (cb && err) {
          cb(err);
        } else {
          cb();
        }
      }
    }
  });
}

function selectPagesForReparse(addedFiles, addedDirs, removedFiles, removedDirs) {
  return Promise.resolve().then(() => {
    const dirPaths = _.uniq(addedFiles
      .concat(addedDirs)
      .concat(removedFiles)
      .concat(removedDirs)
      .map((filePath) => path.parse(filePath).dir));
    
    const rootDirs = dirPaths
      .map((dirPath) => ({
        dirPath,
        isInside: dirPaths
          .filter((dir) => (dir !== dirPath))
          .find((dir) => pathIsInside(dirPath, dir)),
      }))
      .filter((result) => !result.isInside)
      .map((result) => result.dirPath);
    
    const pagesToParse = rootDirs.map((dir) => this.registerPage(dir));

    const cleanups = pagesToParse
      .filter((page) => page.parsed)
      .map((page) => this.cleanPageOutput(page))
    ;
      
    if (pagesToParse.length > 0) {
      this.log.info(`Selected ${pagesToParse.map((page) => page.path.resolved)} for reparse`);
    }

    return Promise.all(cleanups)
      .then(() => {
        return pagesToParse
          .map((page) => {
            page.keys.forEach((key) => {
              if (key.resolved && removedFiles.includes(key.resolved)) {
                Object.assign(key, {
                  value: null,
                  dist: null,
                  resolved: null,
                  distFileName: null,
                  cache: null,
                });
              }
            });
            return page;
          });
      });
  });
}

function setupDev(pages, webpackConfigs) {
  return Promise.resolve().then(() => new Promise((resolve) => {
    if (!this.isDEV) {
      throw cannot('setup', 'dev')
        .because('running in production env');
    }

    let initialBuild = true;

    this.inputFileSystem = new CachedInputFileSystem(new NodeJsInputFileSystem(), 60000);
    this.watchFileSystem = new AdenWatchFileSystem(
      this, this.inputFileSystem
    );
    
    this.watchFileSystem.on('hardChanges', (addedFiles, addedDirs, removedFiles, removedDirs) => {
      this.log.event('watch:hardChanges', { addedFiles, addedDirs, removedFiles, removedDirs });

      if (removedDirs.length > 0) {
        const pagesToBeRemoved = this.pages.filter((page) =>
          removedDirs.includes(page.path.resolved)
        );
        
        if (pagesToBeRemoved.length > 0) {
          const removed = pagesToBeRemoved
            .map((page) => this.removePage(page));
          
          return Promise.all(removed)
            .then(() => this.selectPagesForReparse(addedFiles, addedDirs, removedFiles, removedDirs))
            .then((pages) => this.devRebuild(pages));
        }
      }

      this.selectPagesForReparse(addedFiles, addedDirs, removedFiles, removedDirs)
        .then((pages) => this.devRebuild(pages));
    });

    if (webpackConfigs.length > 0) {
      this.applyDevConfig(pages, webpackConfigs);
      this.compiler = webpack(webpackConfigs);
      this.compiler.compilers.forEach((compiler) => Object.assign(compiler, {
        watchFileSystem: this.watchFileSystem,
        inputFileSystem: this.inputFileSystem,
      }));
    }

    this.devHotMiddleware = webpackHotMiddleware(
      {
        plugin: (evt, cb) => {
          if (evt === 'compile') {
            this.hotCompileCb = cb;
          } else if (evt === 'done') {
            this.hotDoneCb = cb;
          }
          this.compiler && this.compiler.plugin(evt, cb);
        },
      },
      {
        path: '/__webpack_hmr', // `${pages[0].basePath}${this.settings.hmrPath}`,
        log: this.log.info.bind(this.log),
        heartbeat: 2000,
      }
    );

    this.app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });

    if (webpackConfigs.length > 0) {
      this.startWatcher((err) => (err ? reject(err) : resolve({ pages })));
    } else {
      resolve({ pages });
    }
  }));
}

// Workaround to allow controlled building of multi watches
function invalidate(left, right) {
  this.invalidations = (this.invalidations || []).concat([{ left, right }]);
}

module.exports = {
  selectPagesForReparse,
  startWatcher,
  devRebuild,
  applyDevConfig,
  setupDev,
  invalidate,
};
