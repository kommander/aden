'use strict';

/**
  Aden
  It's a webserver, your BFF (Backend For Frontend), with a lot of hidden files & folders,
  conveniently wrapping the webpack configuration, to let you focus on loaders for your project,
  and develop a frontend application. It focuses on the
  packaging and delivery of frontend assets, while being an extensible webserver.
  Every path is a page.
 */

// Aden Backend Core
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const path = require('path');
const conflate = require('conflate');
const createHash = require('crypto').createHash;
const loggerMiddleware = require('morgan');
const Logger = require('./aden.logger');


// Core modules
const AdenPage = require('./aden.page.js');
const AdenWebpack = require('./aden.webpack.js');
const AdenDev = require('./aden.dev.js');
const AdenRoutes = require('./aden.routes.js');
const AdenRender = require('./aden.render.js');
const AdenPlugin = require('./aden.plugin.js');
const AdenInit = require('./aden.init.js');
const AdenLoad = require('./aden.load.js');
const AdenBuild = require('./aden.build.js');

const __DEVELOPMENT__ = process.env.NODE_ENV === 'development'; // eslint-disable-line

// TODO: Add config schema
// TODO: Provide Maintenance mode
// TODO: search referenced middleware and plugins at .aden in node_modules as well

function AdenBackend(app, rootConfig) {
  const rootPage = {
    path: './',
    pagesPath: './',
    basePath: '/',
    route: '/',
    shared: '.shared',
    dist: '.dist',
    favicon: path.resolve(__dirname, '../favicon.ico'),
    // TODO: provide basePath as plugin
    // TODO: provide serveStatics as plugin
    serveStatics: true,
    indexFile: 'index.js',
    templateFile: 'index.html',
    styleFile: 'index.css',
    renderFile: '.render.js',
    renderDir: '.render',
    dataFile: '.data.js',
    dataDir: '.data',
    templateEngineFile: '.template.js',
    // test: 'test', // file or folder with index.js, function with err first callback
    // subfolders that will not be treated as sub page
    // TODO: require sub pages to have a .aden file
    ignore: [
      /tmp/, /images/, /img/, /js/, /script/, /^_/, /css/, /style/,
      /lib/, /reducers/, /node_modules/, /components/,
      /bower_components/, /coverage/, /test/, /tests/, /redux/,
      /dist/, /dev$/,
    ], // TODO: Load this from page config as well (merge)
    noWatch: [
      /git/, /node_modules/, /tmp/, /temp/, /dist/,
    ],
    entryNameDelimiter: '.',
    // TODO: Add global setting to enforce entry point names (no candidates, always index)
    allowProgramOptions: true,
    silent: false,
    verbose: false,
    defaults: path.resolve(__dirname, '../pages'),
    useDefaults: true,
    // TODO: (should) Error pages in subpaths override the parent level ones
    error: 'error',
    notFound: '404',
    children: [],
    commons: true,
    createEntry: true,
    inject: true,
    greedyRoutes: false,
  };

  this.pageWebpackLoaders = [];

  this.rootConfig = conflate(rootPage, rootConfig);

  if (this.rootConfig.allowProgramOptions && app.program.app) {
    this.rootConfig.path = app.program.app;
  }

  if (this.rootConfig.allowProgramOptions && app.program.silent) {
    this.rootConfig.silent = true;
  }

  // Resolve paths once on startup and update the paths config before freeze
  this.rootConfig.path = path.resolve(this.rootConfig.path);
  this.rootConfig.dist = path.resolve(this.rootConfig.path, this.rootConfig.dist);

  try {
    const appPackageJson = require(path.resolve(this.rootConfig.path, 'package.json')); // eslint-disable-line
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(this.rootConfig.path).name.toUpperCase();
  }

  const loggerInstance = (new Logger({
    silent: this.rootConfig.silent,
    verbose: this.rootConfig.verbose,
  })).fns;

  this.logger = loggerInstance.namespace(this.name, {
    silent: this.rootConfig.silent,
  });

  // Access Log
  const log = loggerMiddleware('dev', {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.logger.info(buf);
      },
    },
  });

  app.use(log);

  this.app = app;
  this.routes = [];

  if (__DEVELOPMENT__) {
    this.hmrPath = this.rootConfig.basePath + this.hash(JSON.stringify(this.rootConfig));
  }

  // TODO: Move to registerHooks(['name', ...]);
  this.hooks = {
    'pre:load': [],
    'post:load': [],
    'pre:render': [],
    'post:render': [],
    'pre:entry': [],
    'post:entry': [],
    'pre:parse': [],
    'parse:dot': [],
    'post:parse': [],
    'pre:route': [],
    'pre:build': [],
    'post:build': [],
    'pre:setup': [],
    'post:setup': [],
  };

  this.plugins = [];
  this.pluginPaths = [];
}

AdenBackend.prototype = Object.create(EventEmitter.prototype);

AdenBackend.prototype.hash = function hash(value) {
  return createHash('sha1')
    .update(value)
    .digest('hex')
  ;
};

// TODO: Make async
AdenBackend.prototype.loadAdenFile = function loadAdenFile(adenPath, enforce) {
  return Promise.resolve().then(() => {
    const adenFile = path.resolve(adenPath, '.aden');
    try {
      fs.accessSync(adenFile, fs.F_OK | fs.R_OK);
    } catch (ex) {
      if (enforce) {
        this.logger.error(`No .aden at ${adenPath}! (Try with 'touch .aden' or 'aden -h')`); // eslint-disable-line
        process.exit(1);
      }
      return {};
    }
    if (__DEVELOPMENT__) {
      require.cache[require.resolve(adenFile)] = null;
    }
    let adenFileConfig;
    try {
      adenFileConfig = require(adenFile); // eslint-disable-line
    } catch (ex) {
      this.logger.error(`Invalid aden file. ${ex}\n ${ex.stack}`); // eslint-disable-line
      process.exit(1);
    }
    return adenFileConfig;
  });
};

AdenBackend.prototype.generateWebpackConfig = AdenWebpack.generateWebpackConfig;

AdenBackend.prototype.parsePage = AdenPage.parsePage;
AdenBackend.prototype.updatePageConfigs = AdenPage.updatePageConfigs;
AdenBackend.prototype.updatePageConfig = AdenPage.updatePageConfig;
AdenBackend.prototype.preparePageEntry = AdenPage.preparePageEntry;
AdenBackend.prototype.reducePages = AdenPage.reducePages;

/**
 * This brings together aden parsed pages with webpack
 */
AdenBackend.prototype.load = AdenLoad.load;
AdenBackend.prototype.build = AdenBuild.build;
AdenBackend.prototype.compile = AdenWebpack.compile;

AdenBackend.prototype.init = AdenInit.init;

AdenBackend.prototype.devWatch = AdenDev.devWatch;
AdenBackend.prototype.devWatchListener = AdenDev.devWatchListener;
AdenBackend.prototype.setupDev = AdenDev.setupDev;

AdenBackend.prototype.setupApp = AdenRoutes.setupApp;
AdenBackend.prototype.notFoundRoute = AdenRoutes.notFoundRoute;
AdenBackend.prototype.errorRoute = AdenRoutes.errorRoute;
AdenBackend.prototype.setupRoutes = AdenRoutes.setupRoutes;
AdenBackend.prototype.setupRoute = AdenRoutes.setupRoute;

AdenBackend.prototype.getDefaultRender = AdenRender.getDefaultRender;
AdenBackend.prototype.getDefaultTemplateEngine = AdenRender.getDefaultTemplateEngine;
AdenBackend.prototype.renderPage = AdenRender.renderPage;
AdenBackend.prototype.sendPage = AdenRender.sendPage;
AdenBackend.prototype.loadCustom = AdenRender.loadCustom;
AdenBackend.prototype.emptyData = AdenRender.emptyData;
AdenBackend.prototype.ensureTemplates = AdenRender.ensureTemplates;

//
// Plugin API
AdenBackend.prototype.hook = AdenPlugin.hook;
AdenBackend.prototype.unhook = AdenPlugin.unhook;
AdenBackend.prototype.executeHook = AdenPlugin.executeHook;
AdenBackend.prototype.loadPlugins = AdenPlugin.loadPlugins;
AdenBackend.prototype.loadPlugin = AdenPlugin.loadPlugin;

module.exports = AdenBackend;

//
// Notes and Todos

// TODO: Use promisified fs

// TODO: (should) Deliver nock for API test mocks (integrate with client API facilities)
//       >> Use test nocks from pages to persistently mock test data during development
// TODO: (should) Provide shared input validators
// TODO: (should) Validate pageInfo to make sure we have everything we need,
//       to setup webpack
// TODO: (should) Context Plugin - Allow to hook into delivery here, to allow providing
//       some initial page context by calling some APIs for example.
//       API plugin provides an extendable context by default,
//       modules using the context hook can return and object that
//       will be merged with the preexisting context, not overwriting
//       existing context keys (log warning if a hook tries to).
