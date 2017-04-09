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
const conflate = require('conflate');
const createHash = require('crypto').createHash;
const loggerMiddleware = require('morgan');
const Logger = require('./aden.logger');
const packageJson = require('../package.json');


// Core modules
const AdenBuild = require('./aden.build.js');
const AdenDev = require('./aden.dev.js');
const AdenInit = require('./aden.init.js');
const AdenPage = require('./aden.page.js');
const AdenLoad = require('./aden.load.js');
const AdenPlugin = require('./aden.plugin.js');
const AdenSender = require('./aden.sender.js');
const AdenRoutes = require('./aden.routes.js');
const AdenWebpack = require('./aden.webpack.js');

// TODO: Get rid of development switches, the only switch should be in aden.init()
const __DEVELOPMENT__ = process.env.NODE_ENV === 'development'; // eslint-disable-line

// TODO: Add config schema
// TODO: search referenced middleware and plugins at .aden in node_modules as well
// TODO: Make work with koa

function AdenBackend(app, rootConfig) {
  // TODO: Keep all paths relative to app root path to allow moving the build
  // This is what .aden extends as root page and app level configuration
  const rootPage = {
    //
    // Page Props
    path: './',
    pagesPath: './', // start parsing a level deeper optionally

    // relative to derived route from path (colliding routes will be detected)
    // path: /app/page1/page2 -> route: /sub -> routes: [/page1/page2/sub, /page1/page2/]
    // path: /app/page1/page2 -> route: ../sub -> routes: [/page1/sub, /page1/page2/]
    // path: /app/page1 -> route: /:user/:id -> routes: [/page1/:user/:id, /page1]
    // TODO: basically makes sure it behaves like express routes (also takes array)
    route: '/',

    shared: '.shared',
    dist: '.dist',

    indexFile: 'index.js',
    templateFile: 'index.html',
    styleFile: 'index.css',
    sendFile: '.send.js',
    sendDir: '.send',
    dataFile: '.data.js',
    dataDir: '.data',
    templateEngineFile: '.template.js',
    // client: false // Deactivate default client delivery
    // client: '.client.js'
    // To extend the default setup at lib/client ?


    entryNameDelimiter: '.',

    commons: true,
    createEntry: true,
    inject: true,

    greedy: false,

    //
    // App Options
    basePath: '/',
    publicPath: '',
    serveStatics: true,
    favicon: path.resolve(__dirname, '../assets/favicon.ico'),
    poweredBy: `aden ${packageJson.version}`,
    defaults: path.resolve(__dirname, './pages'),
    useDefaults: true,
    // TODO: (should) Error pages in subpaths override the parent level ones(?)
    error: 'error',
    notFound: '404',

    //
    // Config
    logger: {
      silent: false,
      verbose: false,
      debug: false,
      format: process.env.NODE_ENV === 'development' ? 'dev' : 'combined',
    },
    // subfolders that will not be treated as sub page
    // TODO: require sub pages to have a .aden file(?) maybe as a setting, default not required
    ignore: [
      /tmp/, /images/, /img/, /js/, /script/, /^_/, /css/, /style/,
      /lib/, /reducers/, /node_modules/, /components/,
      /bower_components/, /coverage/, /test/, /tests/, /redux/,
      /dist/, /dev$/,
    ],
    // TODO: Load this from page config as well (merge)
    noWatch: [
      /git/, /node_modules/, /tmp/, /temp/, /dist/,
    ],

    //
    // Actions (Should be refactored out of here)
    clean: false, // Cleanup dist and temp folders

    // Make sure this cannot be overriden from external configs
    children: [],
  };

  // Webpack loaders gathered from .aden files in page tree
  this.pageWebpackLoaders = [];

  this.rootConfig = conflate(rootPage, rootConfig);

  // Resolve paths once on startup and update the paths config before freeze
  this.rootConfig.path = path.resolve(this.rootConfig.path);

  // TODO: warn when dist path is outside of app path
  this.rootConfig.dist = path.resolve(this.rootConfig.path, this.rootConfig.dist);
  this.rootConfig.publicPath = this.rootConfig.basePath + this.rootConfig.publicPath;
  this.webpackStatsDist = path.resolve(this.rootConfig.dist, 'webpack.stats.json');
  this.pageStatsDist = path.resolve(this.rootConfig.dist, 'pages.json');

  try {
    const appPackageJson = require(path.resolve(this.rootConfig.path, 'package.json')); // eslint-disable-line
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(this.rootConfig.path).name.toUpperCase();
  }

  const loggerInstance = (new Logger({
    silent: this.rootConfig.logger.silent,
    verbose: this.rootConfig.logger.verbose,
    debug: this.rootConfig.logger.debug,
  })).fns;

  this.logger = loggerInstance.namespace(this.name, {
    silent: this.rootConfig.logger.silent,
    verbose: this.rootConfig.logger.verbose,
    debug: this.rootConfig.logger.debug,
  });
  this.rootConfig.logger = this.logger;

  // Access Log
  const log = loggerMiddleware(this.rootConfig.logger.format, {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.logger.info(buf);
      },
    },
  });

  app.use(log);

  if (__DEVELOPMENT__) {
    app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });
  }

  this.app = app;
  this.routes = [];

  if (__DEVELOPMENT__) {
    this.hmrPath = `${this.rootConfig.basePath}__ADEN__HMR`;
  }

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
    'pre:route': [],
    'pre:build': [],
    'post:build': [],
    'pre:setup': [],
    'post:setup': [],
    'pre:walk': [],
    'post:walk': [],
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
      this.logger.error(`Invalid aden file.`, ex); // eslint-disable-line
      process.exit(1);
    }
    return adenFileConfig;
  });
};

AdenBackend.prototype.generateWebpackConfig = AdenWebpack.generateWebpackConfig;

AdenBackend.prototype.parsePage = AdenPage.parsePage;
AdenBackend.prototype.updatePageConfigs = AdenPage.updatePageConfigs;
AdenBackend.prototype.updatePageConfig = AdenPage.updatePageConfig;
AdenBackend.prototype.applyPageOnWebpack = AdenPage.applyPageOnWebpack;
AdenBackend.prototype.reducePages = AdenPage.reducePages;

/**
 * This brings together aden parsed pages with webpack
 */
AdenBackend.prototype.load = AdenLoad.load;
AdenBackend.prototype.loadBuild = AdenLoad.loadBuild;
AdenBackend.prototype.loadPages = AdenLoad.loadPages;
AdenBackend.prototype.walkPages = AdenLoad.walkPages;
AdenBackend.prototype.postLoadWalk = AdenLoad.postLoadWalk;
AdenBackend.prototype.resolvePaths = AdenLoad.resolvePaths;
AdenBackend.prototype.executeDotFiles = AdenLoad.executeDotFiles;

AdenBackend.prototype.build = AdenBuild.build;
AdenBackend.prototype.writeWebpackStats = AdenBuild.writeWebpackStats;
AdenBackend.prototype.writePageStats = AdenBuild.writePageStats;
AdenBackend.prototype.serializePages = AdenBuild.serializePages;
AdenBackend.prototype.clean = AdenBuild.clean;

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

AdenBackend.prototype.getDefaultTemplateEngine = AdenSender.getDefaultTemplateEngine;
AdenBackend.prototype.sendPage = AdenSender.sendPage;
AdenBackend.prototype.loadCustom = AdenSender.loadCustom;
AdenBackend.prototype.emptyData = AdenSender.emptyData;
AdenBackend.prototype.defaultSend = AdenSender.defaultSend;
AdenBackend.prototype.ensureTemplates = AdenSender.ensureTemplates;

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

// TODO: (should) Validate pageInfo to make sure we have everything we need,
//       to setup webpack
