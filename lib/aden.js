'use strict';

/**
  Aden
  Backend For Frontend.

  It focuses on the packaging and delivery of frontend assets,
  development tools and app setup automation,
  while being an extensible node express server.

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
const cannot = require('cannot');

// Core modules
const AdenConstants = require('./aden.constants.js');
const AdenBuild = require('./aden.build.js');
const AdenDev = require('./aden.dev.js');
const AdenInit = require('./aden.init.js');
const AdenPage = require('./aden.page.js');
const AdenLoad = require('./aden.load.js');
const AdenExtend = require('./aden.extend.js');
const AdenRoutes = require('./aden.routes.js');
const AdenWebpack = require('./aden.webpack.js');

// TODO: (Add config schema) -> validate server and page configurations (sanity checks)
// TODO: search referenced plugins at .aden in node_modules as well
// TODO: Make work with koa

// Everything that can be written as a extension, should be written as an extension.
// No design by commitee. No complete rewrites, iterate.
//
// Aden always only knows about two environments: development & production.
// (In reality, there should always only be a production env, screw NODE_ENV)
//
// rootConfig should always be optional
function AdenBackend(...args) {
  // Aden keeps all paths relative to app root path to allow moving the build
  this.id = uuid.v1();
  this.app = args[0] && args[1] ? args[0] : express();
  const opts = args[0] && args[1] ? args[1] || {} : args[0] || {};

  this.config = _.merge({
    webpackStatsDist: 'webpack.stats.json',
    pageStatsDist: 'pages.json',
    hmrPath: '__ADEN__HMR',
    extensionsPath: path.resolve(__dirname, '../extensions'),
    logger: {
      format: this.isDEV ? 'dev' : 'combined',
    },
    dotFile: [
      '.aden', '.server', '.page', '.endpoint',
      '.aden.js', '.server.js', '.page.js', '.endpoint.js',
      '.aden.json', '.server.json', '.page.json', '.endpoint.json',
    ],
  }, opts);
  // TODO: add _explicit_ option, to only treat folder as pages that contain
  // a .page file. config: { pageMarker: ['.page']}

  // Ensure aden is running in production mode if not explicitly set otherwise
  // There should be no check for process.env.NODE_ENV anywhere downstream
  this.isPROD = process.env.NODE_ENV === 'production'
    || (!!!process.env.NODE_ENV && !this.config.dev);
  this.isDEV = this.config.dev || !this.isPROD;

  if (this.isPROD) {
    process.env.NODE_ENV = 'production';
  } else if (this.isDEV) {
    process.env.NODE_ENV = 'development';
  }

  this.app.set('env', this.isDEV ? 'development' : 'production');

  // TODO: Move to registerHooks(['name', ...]);
  this.hooks = {
    'pre:load': [],
    'post:load': [],
    'pre:send': [],
    'post:send': [],
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
    apply: [], // Apply page to webpack config
    'post:apply': [], // Applied pages to webpack config
  };

  this.namedExtensions = {};
  this.fileHandlers = [];
  this.keys = [];
  this.watchKeys = [];
  this.extensions = [];

  // Try to avoid messing with native require.
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

AdenBackend.prototype.registerFiles = function registerFiles(keyName, regex, opts = {}) {
  return this.registerFile(keyName, regex, _.extend(opts, { multi: true }));
};

AdenBackend.prototype.registerFile = function registerFile(keyName, regex, opts = {}) {
  this.logger.debug('registerFile(s)', { keyName, regex, opts });

  this.registerKey(keyName, _.extend(opts.key, {
    type: opts.multi ? AdenConstants.KEY_TYPE_FILE_ARRAY : AdenConstants.KEY_TYPE_FILE,
    value: opts.multi ? [] : null,
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
        value: opts.multi ? (key.value || []).concat(fileInfo) : fileInfo.rpath,
      });

      return opts.fn ? opts.fn({ page, fileInfo, key }) : { page, fileInfo, key };
    },
  };

  this.fileHandlers.push(handler);
};

/**
 * Adding a key to the page which can be used by extensions to add information
 * the ext. needs to handle the page. Files are registered as `file` keys
 * and follow the same basic behaviour as all other keys.
 *
 * Example:
 * The `hbs` extension registers the key `templates`, to allow access to
 * render methods like `page.key.templates.hello.render(...)`.
 * Note: this should change to `page.get('templates').hello.render(...)`
 *
 * This mechanism is used to avoid extensions messing with each other.
 */
AdenBackend.prototype.registerKey = function registerKey(name, key) {
  this.logger.debug('registerKey', name, key);

  if (key.type && !AdenConstants.allowedKeyTypes.includes(key.type)) {
    throw cannot('register', 'key')
      .because('type is not supported').addInfo(key.type);
  }

  const newKey = _.extend({
    type: AdenConstants.KEY_TYPE_STRING,
    inherit: false,
    build: false,
    value: null,
    multi: false,
    watch: false,
  }, key, {
    name,
  });

  // TODO: Check for colliding keys
  this.keys.push(newKey);

  return newKey;
};

AdenBackend.prototype.applyKeys = function applyKeys(page, keys) {
  return Promise.resolve().then(() => {
    const applied = keys.map((key) => {
      const newKey = Object.assign({}, key);

      if (!newKey.inherit) {
        if (newKey.type === AdenConstants.KEY_TYPE_FILE_ARRAY) {
          newKey.value = [];
        } else if (newKey.type === AdenConstants.KEY_TYPE_CUSTOM) {
          newKey.value = newKey.value;
        } else {
          newKey.value = null;
        }
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
    const adenFiles = this.config.dotFile
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
        this.logger.error(`No .server at ${adenPath}! (Try with 'touch .server' or 'aden -h')`);
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
      adenFileConfig = this.nativeRequire(adenFile);
      this.logger.debug('Got .aden config', { adenFile, adenFileConfig });
    } catch (ex) {
      this.logger.error(`Invalid aden file at ${adenFile}.`, ex);
      if (!this.isDEV) {
        process.exit(1);
      }
      return {};
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
AdenBackend.prototype.hook = AdenExtend.hook;
AdenBackend.prototype.unhook = AdenExtend.unhook;
AdenBackend.prototype.applyHook = AdenExtend.applyHook;
AdenBackend.prototype.loadExtensions = AdenExtend.loadExtensions;
AdenBackend.prototype.loadExtension = AdenExtend.loadExtension;

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
      this.app = null;
      done();
    });
  }
};

module.exports = createAdenBackend;

//
// Notes and Todos
// TODO: detect babel-core/register usage and warn
// TODO: Use promisified fs

// TODO: (should) Validate pageInfo to make sure we have everything we need,
//       to setup webpack
// TODO: Use a state machine (maybe redux?) to handle server state.
//       -> auto rollback to last working state on breaking changes (live mode)
