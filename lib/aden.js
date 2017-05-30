'use strict';

/**
  Aden
  Backend For Frontend.

  She focuses on packaging and delivery of frontend assets,
  development tools and app setup automation,
  while being an extensible node express application server.

  Every path is a page.
 */

// Aden Backend Core
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const express = require('express');
const uuid = require('uuid');
const cannot = require('brokens');
const logger = require('./aden.logger');
const http = require('http');

// Core modules
const AdenBuild = require('./aden.build.js');
const AdenDev = require('./aden.dev.js');
const AdenInit = require('./aden.init.js');
const AdenPage = require('./aden.page.js');
const AdenLoad = require('./aden.load.js');
const AdenExtend = require('./aden.extend.js');
const AdenRoutes = require('./aden.routes.js');
const AdenWebpack = require('./aden.webpack.js');

// TODO: (Add config schema) -> validate server and page configurations (sanity checks)
// TODO: search referenced attitudes at .aden in node_modules as well
// TODO: Make work with koa

// Everything that can be written as an attitude, should be written as an attitude.
// No design by commitee. No complete rewrites, iterate.
//
// Aden always only knows about two environments: development & production.
// Aden keeps all paths relative to app root path to allow moving the build
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
  Object.assign(this.app, {
    listen: (...rest) => {
      this.server.listen.apply(this.server, rest);
    },
  });

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
      '.aden', '.server', '.page', '.endpoint',
      '.aden.js', '.server.js', '.page.js', '.endpoint.js',
      '.aden.json', '.server.json', '.page.json', '.endpoint.json',
    ],
    attitudes: [],
    // SSL Settings and paths to certificates go here
  }, settings);
  // TODO: use https://www.npmjs.com/package/environmental
  //       -> override file config with corresponding env vars

  // TODO: add _explicit_ option, to only treat folder as pages that contain
  // a .page file. config: { pageMarker: ['.page']}

  this.log = logger(this.settings.logger).namespace('aden');

  // Ensure aden is running in production mode if not explicitly set otherwise
  // There should be no check for process.env.NODE_ENV anywhere downstream
  this.isDEV = !!this.settings.dev;

  if (!this.isDEV) {
    process.env.NODE_ENV = 'production';
  } else if (this.isDEV) {
    process.env.NODE_ENV = 'development';
  }

  this.app.set('env', this.isDEV ? 'development' : 'production');

  this.hooks = {};
  this.registerHooks([
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
    'route:error', // when the error handler is hit
    'route:notFound', // when the 404 handler is hit
    'html',
    'setup',
    'load',
    'apply', // Apply page to webpack config
    'post:apply', // Applied pages to webpack config
    'pre:deploy',
    'deploy',
    'post:deploy',
  ]);

  this.namedAttitudes = {};
  this.watchKeys = [];
  this.attitudes = {};
  this.deployTargets = [];
  this.pagesById = {};
  this.pages = [];

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

AdenBackend.prototype.getPage = function getPage(id) {
  return this.pagesById[id];
};

AdenBackend.prototype.registerDeployTarget = function registerDeployTarget(name, opts = {}) {
  if (this.deployTargets[name]) {
    this.log.error(cannot('register', 'deployTarget')
      .because('it already exists').addInfo(name));
    return this;
  }

  Object.assign(this.deployTargets, {
    [name]: _.extend(opts, { name }),
  });

  return this;
};

const pageCache = {};
AdenBackend.prototype.registerPage = function registerPage(absPath, settings = {}) {
  if (!path.isAbsolute(absPath)) {
    throw cannot('register', 'page').because('I need an absolute path');
  }

  if (this.isDev && pageCache[absPath]) {
    return pageCache[absPath];
  }

  const page = this.createPage(absPath, settings);
  pageCache[absPath] = page;

  this.pagesById[page.id] = page;
  this.pages.push(page);

  return page;
};

// TODO: Make async
AdenBackend.prototype.loadDotServerFile = function loadDotServerFile(pagePath, enforce) {
  return Promise.resolve().then(() => {
    // TODO: Apparently this should be configurable
    //       -> add cli --server-file .website or smth.
    const dotServerFiles = this.settings.dotFile
      .map((file) => path.resolve(pagePath, file))
      .filter((filePath) => {
        try {
          fs.accessSync(filePath, fs.F_OK | fs.R_OK);
          this.log.debug('Adenfile access fine', { filePath });
          return true;
        } catch (ex) {
          return false;
        }
      });

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

    let adenFileConfig;
    try {
      if (adenFile.match(/\..*?\..*?$/)) {
        adenFileConfig = this.nativeRequire(adenFile);
      } else {
        // Load server files without any extension as JSON by default
        const configContent = fs.readFileSync(adenFile);
        if (configContent.length > 0) {
          adenFileConfig = JSON.parse(configContent);
        } else {
          adenFileConfig = {};
        }
      }
    } catch (ex) {
      this.log.error(`Invalid aden file at ${adenFile}`, ex);
      if (!this.isDEV) {
        process.exit(1);
      }
      return {};
    }
    return adenFileConfig;
  });
};

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

function createAdenBackend(app, settings) {
  const aden = new AdenBackend(app, settings);
  return aden;
}

AdenBackend.prototype.shutdown = function shutdown(done) {
  if (this.app !== null) {
    this.shutdownInProgress = true;
    if (this.watcher) {
      this.watcher.close();
    }
    process.__ADEN__ = false;

    process.env.NODE_ENV = '';
    this.app = null;
    this.namedAttitudes = null;
    this.watchKeys = null;
    this.attitudes = null;
    this.pages = null;

    // WARN: native bindings should not be reloaded within one process this
    // setup is currently only used for testing you should not restart an aden
    // instance within the same process
    Object.keys(require.cache)
      .filter((key) => !key.match(/\.node$/))
      .forEach((key) => {
        if (!key.match(/node_modules/)) {
          delete require.cache[key];
        }
      });

    if (this.server) {
      this.server.close();
    }

    if (typeof done === 'function') {
      done();
    }
  }
};

module.exports = createAdenBackend;

//
// Notes and Todos
// TODO: Use promisified fs
