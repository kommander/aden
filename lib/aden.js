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
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const createHash = require('crypto').createHash;
const express = require('express');
const uuid = require('uuid');
const util = require('util');
const cannot = require('brokens');
const logger = require('./aden.logger');
const http = require('http');

// Core modules
const adenConstants = require('./aden.constants.js');
const {
  KEY_TYPE_STRING,
  KEY_TYPE_CUSTOM,
  KEY_TYPE_FILE_ARRAY,
  KEY_TYPE_FILE,
  KEY_TYPE_APATH,
  ENTRY_TYPE_STATIC,
  ENTRY_TYPE_DYNAMIC,
  KEY_TYPE_ARRAY,
  allowedKeyTypes,
} = adenConstants;
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
// rootConfig in args should always be optional
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

  // TODO: Move to registerHooks(['name', ...]);
  this.hooks = {
    init: [],
    'pre:load': [],
    'post:load': [],
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
    'pre:deploy': [],
    deploy: [],
    'post:deploy': [],
    'route:error': [],
    'route:notFound': [],
    html: [],
    'post:html': [],
    setup: [],
    load: [],
    apply: [], // Apply page to webpack config
    'post:apply': [], // Applied pages to webpack config
  };

  this.namedAttitudes = {};
  this.fileHandlers = [];
  this.keys = [];
  this.watchKeys = [];
  this.attitudes = [];
  this.deployTargets = [];

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

util.inherits(AdenBackend, EventEmitter);

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

AdenBackend.prototype.registerFiles = function registerFiles(keyName, regex, opts = {}) {
  return this.registerFile(keyName, regex, _.extend(opts, {
    type: KEY_TYPE_FILE_ARRAY,
  }));
};

AdenBackend.prototype.registerFile = function registerFile(keyName, regex, opts = {}) {
  this.registerKey(keyName, _.extend({
    type: KEY_TYPE_FILE,
  }, opts, {
    inherit: false,
  }));

  const handler = {
    keyName,
    matcher: ({ page, fileInfo }) => (typeof regex === 'function'
      ? regex({ page, fileInfo })
      : fileInfo.file.match(regex)
    ),
    fn: ({ page, fileInfo, key }) => {
      Object.assign(key, {
        value: key.type === KEY_TYPE_FILE_ARRAY
          ? (key.value || []).concat(fileInfo)
          : fileInfo.rpath,
      });

      return opts.handler ? opts.handler({ page, fileInfo, key }) : { page, fileInfo, key };
    },
  };

  this.fileHandlers.push(handler);
};

/**
 * Adding a key to the page which can be used by attitudes to add information
 * the attitude needs to handle the page. Files are registered as `file` type keys
 * and follow the same basic behaviour as all other keys.
 *
 * Example:
 * The `hbs` attitue registers the key `templates`, to allow access to
 * render methods like `page.key.templates.hello.render(...)`.
 * Note: this should change to `page.get('templates').hello.render(...)`
 *
 * This mechanism is used to avoid attitudes messing with each other.
 */
AdenBackend.prototype.registerKey = function registerKey(name, key = {}) {
  if (key.type && !allowedKeyTypes.includes(key.type)) {
    throw cannot('register', 'key')
      .because('type is not supported').addInfo(key.type);
  }

  // TODO: check for overlapping registered KEY_TYPE_DIST_PATH
  // TODO: add rootOnly keys (will only be taken from the root .server)
  // Use Case: the default pages path for status pages for example,
  //           should only be taken from root config once
  const newKey = _.extend({
    type: KEY_TYPE_STRING,
    inherit: false,
    build: false,
    value: null,
    watch: false,
    store: true,
    config: false,
    distExt: null,
    // ENTRY_TYPE_STATIC | ENTRY_TYPE_DYNAMIC | null (not an entry point)
    // -> Determines if a key holds info about an entry point and how to build it
    entry: null,
  }, key, {
    name,
    cache: null,
  });

  // TODO: Check for colliding keys (also check if default keys are colliding)
  this.keys.push(newKey);

  return this;
};

AdenBackend.prototype.has = function has(keyName) {
  return this.keys.find((key) => (key.name === keyName));
};

// TODO: page.has(keyName) -> if key and value exists

AdenBackend.prototype.applyKeys = function applyKeys(page, keys) {
  return Promise.resolve().then(() => {
    const applied = keys.map((key) => {
      const newKey = _.cloneDeep(key);

      if (!newKey.inherit) {
        if (newKey.type === KEY_TYPE_FILE_ARRAY) {
          newKey.value = [];
        } else if (
          newKey.type === KEY_TYPE_CUSTOM
          || newKey.type === KEY_TYPE_APATH
        ) {
          newKey.value = newKey.value;
        } else {
          newKey.value = null;
        }
      }

      if (!newKey.value && newKey.default) {
        const value = typeof newKey.default === 'function'
          ? newKey.default(this.ui)
          : newKey.default;
        Object.assign(newKey, { value });
      }

      return newKey;
    });

    return Object.assign(page, {
      keys: applied,
      key: applied.reduce((obj, key) => Object.assign(obj, { [key.name]: key }), {}),
    });
  });
};

AdenBackend.prototype.hash = function hash(value) {
  return createHash('sha1')
    .update(value)
    .digest('hex')
  ;
};

// TODO: Make async
AdenBackend.prototype.loadAdenFile = function loadAdenFile(adenPath, enforce) {
  return Promise.resolve().then(() => {
    // TODO: Apparently this should be configurable
    //       -> add cli --server-file .website or smth.
    const adenFiles = this.settings.dotFile
      .map((file) => path.resolve(adenPath, file))
      .filter((filePath) => {
        try {
          fs.accessSync(filePath, fs.F_OK | fs.R_OK);
          this.log.debug('Adenfile access fine', { filePath });
          return true;
        } catch (ex) {
          return false;
        }
      });

    this.log.debug('Loading .aden', { adenFiles });

    if (adenFiles.length === 0) {
      if (enforce) {
        throw cannot('start', 'up')
          .because(`no .server file at ${adenPath}`)
          .addInfo('Try with "touch .server" or "aden -h"');
      }

      this.log.debug('No aden file at', { adenPath });
      return {};
    }

    const adenFile = adenFiles[0];

    if (adenFiles.length > 1) {
      this.log.warn(`Multiple server config files, using ${adenFile}`, { adenFiles });
    }

    if (this.isDEV) {
      this.log.debug('Reset .aden require cache', { adenFile });
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
      this.log.debug('Got .aden config', { adenFile, adenFileConfig });
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

AdenBackend.prototype.generateWebpackConfig = AdenWebpack.generateWebpackConfig;
AdenBackend.prototype.getDefaultWebpackPlugins = AdenWebpack.getDefaultWebpackPlugins;

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
AdenBackend.prototype.runStartupCallback = AdenInit.runStartupCallback;

AdenBackend.prototype.devWatch = AdenDev.devWatch;
AdenBackend.prototype.devWatchListener = AdenDev.devWatchListener;
AdenBackend.prototype.setupDev = AdenDev.setupDev;

AdenBackend.prototype.setupApp = AdenRoutes.setupApp;
AdenBackend.prototype.notFoundRoute = AdenRoutes.notFoundRoute;
AdenBackend.prototype.errorRoute = AdenRoutes.errorRoute;
AdenBackend.prototype.setupRoutes = AdenRoutes.setupRoutes;
AdenBackend.prototype.defaultErrorResponse = AdenRoutes.defaultErrorResponse;

AdenBackend.prototype.sendPage = AdenRoutes.sendPage;
AdenBackend.prototype.loadCustom = AdenRoutes.loadCustom;

//
// Plugin API
AdenBackend.prototype.hook = AdenExtend.hook;
AdenBackend.prototype.unhook = AdenExtend.unhook;
AdenBackend.prototype.applyHook = AdenExtend.applyHook;
AdenBackend.prototype.loadAttitudes = AdenExtend.loadAttitudes;
AdenBackend.prototype.loadAttitude = AdenExtend.loadAttitude;

function createAdenBackend(app, rootConfig) {
  const aden = new AdenBackend(app, rootConfig);
  return aden;
}

AdenBackend.prototype.shutdown = function shutdown(done) {
  if (this.app !== null) {
    this.shutdownInProgress = true;
    if (this.watcher) {
      this.watcher.close();
    }
    process.__ADEN__ = false;
    process.nextTick(() => {
      process.env.NODE_ENV = '';
      this.app = null;
      this.namedAttitudes = null;
      this.fileHandlers = null;
      this.keys = null;
      this.watchKeys = null;
      this.attitudes = null;
      this.pages = null;

      // WARN: native bindings should not be reloaded within one process this
      // setup is currently only used for testing you should not restart an aden
      // instance within the same process
      Object.keys(require.cache)
        .filter((key) => !key.match(/\.node$/))
        .forEach((key) => {
          delete require.cache[key];
        });

      if (this.server) {
        this.server.close();
      }

      done();
    });
  }
};

module.exports = createAdenBackend;

//
// Notes and Todos
// TODO: Use promisified fs

// TODO: (should) Validate pageInfo to make sure we have everything we need,
//       to setup webpack
// TODO: Use a state machine (maybe redux?) to handle server state.
//       -> auto rollback to last working state on breaking changes (live mode)
