'use strict';

/**
  Aden
  Backend For Frontend.

  She focuses on packaging and delivery of frontend assets,
  development tools and app setup automation,
  while being an extensible node express application server.

  Every path is a page.
 */

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const express = require('express');
const uuid = require('uuid');
const cannot = require('brokens');
const http = require('http');

// Core modules
const Logger = require('./aden.logger');
const AdenBuild = require('./aden.build.js');
const AdenDev = require('./aden.dev.js');
const AdenInit = require('./aden.init.js');
const AdenPage = require('./aden.page.js');
const AdenLoad = require('./aden.load.js');
const AdenExtend = require('./aden.extend.js');
const AdenRoutes = require('./aden.routes.js');
const AdenWebpack = require('./aden.webpack.js');
const AdenConstants = require('./aden.constants.js');
const Attitude = require('./aden.attitude.js');

// Everything that can be written as an attitude, should be written as an attitude.
// Iterate.
//
// Aden always only knows about two environments: development & production.
// Aden keeps all paths relative to app root path to allow moving the build.
//
function AdenBackend(...args) {
  this.id = uuid.v1();
  this.app = args[0] && args[1]
    ? args[0]
    : express();
  const settings = args[0] && args[1]
    ? args[1] || {}
    : args[0] || {};

  this.server = http.createServer(this.app);
  this.listen = (...rest) => {
    this.server.listen.apply(this.server, rest);
  };
  Object.assign(this.app, {
    listen: this.listen.bind(this),
  });

  // Ensure aden is running in production mode if not explicitly set otherwise.
  // There should be no check for process.env.NODE_ENV anywhere downstream.
  this.isDEV = !!settings.dev;

  this.settings = _.merge({
    publicPath: '/',
    dist: '.dist',
    webpackStatsDist: 'webpack.stats.json',
    pageStatsDist: 'pages.json',
    hmrPath: '__ADEN__HMR',
    attitudesPath: path.resolve(__dirname, '../attitudes'),
    logger: {
      format: this.isDEV ? 'dev' : 'combined',
    },
    dotFile: [
      '.aden', '.server',
      '.aden.js', '.server.js',
      '.aden.json', '.server.json',
    ],
    attitudes: [],
    // SSL Settings and paths to certificates go here
  }, settings);

  this.log = Logger(this.settings.logger).namespace('aden');

  if (!this.isDEV) {
    process.env.NODE_ENV = 'production';
  } else {
    process.env.NODE_ENV = 'development';
  }

  this.app.set('env', this.isDEV ? 'development' : 'production');

  this.hooks = {};
  this.registerHooks([
    'init:page',
    'init',
    'pre:load',
    'post:load',
    'pre:parse',
    'parse:dot',
    'post:parse',
    'boot',
    'pre:build',
    'post:build',
    'pre:setup:walk',
    'post:setup:walk',
    'pre:deserialize',
    'post:deserialize',
    'setup:route',
    'html',
    'setup',
    'setup:page',
    'post:setup',
    'load',
    'pre:apply',
    'apply', // Apply page to webpack config
    'post:apply', // Applied pages to webpack config
    'pre:deploy',
    'deploy',
    'post:deploy',
  ]);

  this.watchKeys = [];
  this.attitudes = {};
  this.deployTargets = [];
  this.pagesById = {};
  this.pages = [];
  this.pageCache = {};
  this.pagesToBeRemoved = [];

  this.fileSystem = fs;

  // Use this to avoid problems with app level components messing with require.
  // It allows app modules to change require,
  // but will use default extensions for aden core.
  const rExtensions = Object.assign({}, require.extensions);
  this._nativeRequire = require;
  this.nativeRequire = (request) => {
    Object.assign(this._nativeRequire.extensions, rExtensions);
    return this._nativeRequire(request);
  };
}

function createAdenBackend(app, settings) {
  const aden = new AdenBackend(app, settings);
  return aden;
}
module.exports = createAdenBackend;

// Expose for Attitude development
createAdenBackend.Constants = AdenConstants;
createAdenBackend.Attitude = Attitude;

_.extend(
  AdenBackend.prototype,
  AdenWebpack,
  AdenPage,
  AdenLoad,
  AdenBuild,
  AdenInit,
  AdenDev,
  AdenRoutes,
  AdenExtend
);

AdenBackend.prototype.getPage = function getPage(id) {
  return this.pagesById[id];
};

AdenBackend.prototype.registerDeployTarget = function registerDeployTarget(name, opts = {}) {
  if (this.deployTargets[name]) {
    this.log.error('Deploy target error', cannot('register', 'deployTarget')
      .because('it already exists').addInfo(name));
    return this;
  }

  Object.assign(this.deployTargets, {
    [name]: _.extend(opts, { name }),
  });

  return this;
};

AdenBackend.prototype.checkAccessMulti = function(pagePath, files) {
  return files
    .map((file) => path.resolve(pagePath, file))
    .filter((filePath) => {
      try {
        fs.accessSync(filePath, fs.F_OK | fs.R_OK);
        this.log.debug('File access fine', { filePath });
        return true;
      } catch (ex) {
        return false;
      }
    });
};

AdenBackend.prototype.loadNativeOrJSON = function(filePath) {
  try {
    let config;
    if (filePath.match(/\..*?\..*?$/)) {
      config = this.nativeRequire(filePath);
    } else {
      const configContent = fs.readFileSync(filePath);
      if (configContent.length > 0) {
        config = JSON.parse(configContent);
      } else {
        config = {};
      }
    }
    return config;
  } catch (ex) {
    this.log.error(`Invalid file at ${filePath}`, ex);
    if (!this.isDEV) {
      process.exit(1);
    }
    return {};
  }
};

/**
 * .server file loader
 * Checks the given path for potential server configuration files, if found, loads it.
 */
AdenBackend.prototype.loadDotServerFile = function loadDotServerFile(pagePath, enforce) {
  return Promise.resolve().then(() => {
    const dotServerFiles = this.checkAccessMulti(pagePath, this.settings.dotFile);
      
    if (dotServerFiles.length === 0) {
      if (enforce) {
        throw cannot('start', 'up')
          .because(`no .server file at ${pagePath}`)
          .addInfo('Try with "touch .server" or "aden -h"');
      }
      return {};
    }

    const adenFile = dotServerFiles[0];

    if (dotServerFiles.length > 1) {
      this.log.warn(`Multiple server config files, using ${adenFile}`, { dotServerFiles });
    }

    if (this.isDEV) {
      require.cache[require.resolve(adenFile)] = null;
    }

    return this.loadNativeOrJSON(adenFile);
  });
};

AdenBackend.prototype.shutdown = function shutdown(done) {
  this.log.start('Attempting Graceful shutdown');

  if (process.__ADEN__ === true) {
    try {
      this.shutdownInProgress = true;
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }

      clearTimeout(this.devWatchTimeout);

      process.env.NODE_ENV = '';

      this.app = null;
      this.watchKeys = null;
      this.attitudes = null;
      this.deployTargets = null;
      this.pagesById = null;
      this.pages = null;
      this.pageCache = null;
      this.settings = null;
      this.nativeRequire = null;
      this._nativeRequire = null;
      this.hooks = null;
      this.compiler = null;
      this.rootPage = null;
      this.hotCompileCb = null;
      this.hotDoneCb = null;
      this.router = null;
      this.devWatchListenerBound = null;
      this.devHotMiddleware = null;
      this.webpackStats = null;
      this.pagesToBeRemoved = null;

      // Native bindings should not be reloaded within one process. This
      // setup is currently only used for testing. You should not restart an aden
      // instance within the same process.
      Object.keys(require.cache)
        .filter((key) => !key.match(/\.node$/))
        .forEach((key) => {
          if (
            !key.match(/node_modules/)
            && !key.match(/aden[\/|\\]lib[\/|\\]aden/)
            && !key.match(/aden[\/|\\]index.js/)
            && !key.match(/aden[\/|\\]test[\/|\\]integration/)
            && !key.match(/aden[\/|\\]test[\/|\\]lib/)
            && !key.match(/aden[\/|\\]attitudes/)
          ) {
            delete require.cache[key];
          }
        });

      if (this.server) {
        this.server.close();
        this.server = null;
      }

      if (this.devMiddleware) {
        this.devMiddleware.close();
      }

      process.__ADEN__ = false;

      this.log.success('Graceful shutdown done.');
      this.log = null;
    } catch (ex) {
      this.log.error('Shutdown Failed', ex);
    }
  }

  if (typeof done === 'function') {
    done();
  }
};

AdenBackend.prototype.shutdownAndExit = function shutdownAndExit(code) {
  this.shutdown();
  process.exit(code || 0);
};