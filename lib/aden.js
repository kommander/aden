'use strict';

/**
  Aden
  Backend For Frontend.

  Conveniently wrapping the webpack configuration, to let you focus on loaders for your project,
  and develop a frontend application. It focuses on the packaging and delivery of frontend assets,
  development tools and app setup automation, while being an extensible node express server.

  Every path is a page.
 */

// Aden Backend Core
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const createHash = require('crypto').createHash;

// Core modules
const AdenBuild = require('./aden.build.js');
const AdenDev = require('./aden.dev.js');
const AdenInit = require('./aden.init.js');
const AdenPage = require('./aden.page.js');
const AdenLoad = require('./aden.load.js');
const AdenPlugin = require('./aden.plugin.js');
const AdenRoutes = require('./aden.routes.js');
const AdenWebpack = require('./aden.webpack.js');

// TODO: (Add config schema) -> validate server and page configurations (sanity checks)
// TODO: search referenced plugins at .aden in node_modules as well
// TODO: Make work with koa

// Everything that can be written as a plugin, should be written as a plugin.
//
// rootConfig should always be optional
function AdenBackend(app, config) {
  // Ensure aden is running in production mode if not explicitly set otherwise
  // There should be no process.env.NODE_ENV anywhere downstream
  this.isPROD = process.env.NODE_ENV === 'production'
    || (!!!process.env.NODE_ENV && !config.dev);
  this.isDEV = config.dev && !this.isPROD;

  this.config = _.merge({
    webpackStatsDist: 'webpack.stats.json',
    pageStatsDist: 'pages.json',
    hmrPath: '__ADEN__HMR',
    pluginsPath: path.resolve(__dirname, 'extensions'),
    logger: {
      format: this.isDEV ? 'dev' : 'combined',
    },
  }, config);

  // Aden keeps all paths relative to app root path to allow moving the build

  // Webpack loaders gathered from .aden files in page tree
  this.pageWebpackLoaders = [];

  this.app = app;

  // TODO: Move to registerHooks(['name', ...]);
  this.hooks = {
    'pre:load': [],
    'post:load': [],
    'pre:send': [],
    'post:send': [],
    'pre:entry': [],
    'post:entry': [],
    'pre:parse': [],
    'parse:dot': [],
    'post:parse': [],
    'pre:build': [],
    'post:build': [],
    'pre:setup:walk': [],
    'post:setup:walk': [],
    'pre:deserialize': [],
    'post:deserialize': [],
    'setup:route': [],
    setup: [],
    load: [],
    apply: [], // Apply webpack config
  };

  this.namedExtensions = {};
  this.fileHandlers = [];
  this.keys = [];
  this.extensions = [];
}

AdenBackend.prototype = Object.create(EventEmitter.prototype);

AdenBackend.prototype.registerFile = function registerFile(regex, fn) {
  this.logger.debug('registerFile', { regex, fn });

  // TODO: Check for colliding handlers (probably at runtime when a file is handled twice)
  this.fileHandlers.push({
    regex,
    fn,
  });
};

AdenBackend.prototype.registerKey = function registerKey(key) {
  this.logger.debug('registerKey', key);

  // TODO: Check for colliding keys
  this.keys.push(_.merge({
    inherit: true,
  }, key));
};


AdenBackend.prototype.hash = function hash(value) {
  return createHash('sha1')
    .update(value)
    .digest('hex')
  ;
};

// TODO: Make async
// TODO: allow .aden.js, .aden.json, aden.yml
AdenBackend.prototype.loadAdenFile = function loadAdenFile(adenPath, enforce) {
  return Promise.resolve().then(() => {
    // TODO: Apparently this should be configurable
    //       -> add cli --server-file .website or smth.
    const adenFiles = ['.aden', '.server', '.page']
      .map((file) => path.resolve(adenPath, file))
      .filter((filePath) => {
        try {
          fs.accessSync(filePath, fs.F_OK | fs.R_OK);
          this.logger.debug('Adenfile access fine', { filePath });
          return true;
        } catch (ex) {
          return false;
        }
      });

    this.logger.debug('Loading .aden', { adenFiles });

    if (adenFiles.length === 0) {
      if (enforce) {
        this.logger.error(`No .aden at ${adenPath}! (Try with 'touch .aden' or 'aden -h')`); // eslint-disable-line
        process.exit(1);
      }

      this.logger.debug('No aden file at', { adenPath });
      return {};
    }

    if (adenFiles.length > 1) {
      this.logger.warn('Multiple server config files', { adenFiles });
    }

    const adenFile = adenFiles[0];

    if (this.isDEV) {
      this.logger.debug('Reset .aden require cache', { adenFile });
      require.cache[require.resolve(adenFile)] = null;
    }

    let adenFileConfig;
    try {
      adenFileConfig = require(adenFile); // eslint-disable-line
      this.logger.debug('Got .aden config', { adenFile, adenFileConfig });
    } catch (ex) {
      this.logger.error(`Invalid aden file.`, ex); // eslint-disable-line
      if (!this.isDEV) {
        process.exit(1);
      }
    }
    return adenFileConfig;
  });
};

AdenBackend.prototype.generateWebpackConfig = AdenWebpack.generateWebpackConfig;

AdenBackend.prototype.parsePage = AdenPage.parsePage;
AdenBackend.prototype.updatePageConfigs = AdenPage.updatePageConfigs;
AdenBackend.prototype.updatePageConfig = AdenPage.updatePageConfig;
AdenBackend.prototype.applyPageOnWebpack = AdenPage.applyPageOnWebpack;
AdenBackend.prototype.flattenPages = AdenPage.flattenPages;
AdenBackend.prototype.applyFileConfig = AdenPage.applyFileConfig;

/**
 * This brings together aden parsed pages with webpack
 */
AdenBackend.prototype.setup = AdenLoad.setup;
AdenBackend.prototype.loadBuild = AdenLoad.loadBuild;
AdenBackend.prototype.loadPages = AdenLoad.loadPages;
AdenBackend.prototype.walkPages = AdenLoad.walkPages;
AdenBackend.prototype.postLoadWalk = AdenLoad.postLoadWalk;
AdenBackend.prototype.resolvePaths = AdenLoad.resolvePaths;
AdenBackend.prototype.loadDefaultPages = AdenLoad.loadDefaultPages;


AdenBackend.prototype.build = AdenBuild.build;
AdenBackend.prototype.writeWebpackStats = AdenBuild.writeWebpackStats;
AdenBackend.prototype.writePageStats = AdenBuild.writePageStats;
AdenBackend.prototype.serializePages = AdenBuild.serializePages;
AdenBackend.prototype.serializer = AdenBuild.serializer;
AdenBackend.prototype.clean = AdenBuild.clean;

AdenBackend.prototype.compile = AdenWebpack.compile;

AdenBackend.prototype.init = AdenInit.init;
AdenBackend.prototype.run = AdenInit.run;

AdenBackend.prototype.devWatch = AdenDev.devWatch;
AdenBackend.prototype.devWatchListener = AdenDev.devWatchListener;
AdenBackend.prototype.setupDev = AdenDev.setupDev;

AdenBackend.prototype.setupApp = AdenRoutes.setupApp;
AdenBackend.prototype.notFoundRoute = AdenRoutes.notFoundRoute;
AdenBackend.prototype.errorRoute = AdenRoutes.errorRoute;
AdenBackend.prototype.setupRoutes = AdenRoutes.setupRoutes;

AdenBackend.prototype.sendPage = AdenRoutes.sendPage;
AdenBackend.prototype.loadCustom = AdenRoutes.loadCustom;

//
// Plugin API
AdenBackend.prototype.hook = AdenPlugin.hook;
AdenBackend.prototype.unhook = AdenPlugin.unhook;
AdenBackend.prototype.applyHook = AdenPlugin.applyHook;
AdenBackend.prototype.loadExtensions = AdenPlugin.loadExtensions;
AdenBackend.prototype.loadPlugin = AdenPlugin.loadPlugin;

let singleton = null;
function createAdenBackend(app, rootConfig) {
  if (singleton) {
    return singleton;
  }
  singleton = new AdenBackend(app, rootConfig);
  return singleton;
}

module.exports = createAdenBackend;

//
// Notes and Todos

// TODO: Use promisified fs

// TODO: (should) Validate pageInfo to make sure we have everything we need,
//       to setup webpack
