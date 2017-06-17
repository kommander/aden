'use strict';

/**
 * A Page represents the _context_ of a path, gathering all info needed to serve the path.
 * On its own, a page isn't doing anything. It needs an Attitude applied to behave.
 */

const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');
const cannot = require('brokens');

const {
  KEY_OBJECT,
  KEY_FILE_ARRAY,
  KEY_FUNCTION,
  KEY_WEBPACK,
  KEY_RPATH,
  KEY_PAGE_PATH,
  KEY_STRING_ARRAY,
  KEY_ARRAY,
  KEY_STRING,
  KEY_BOOLEAN,
  allowedKeyTypes,
} = require('./aden.constants.js');

// Default Page Keys
function getCoreKeys(pagePath, page) {
  return [
    // TODO: Move to lifecycle attitude
    {
      name: 'startup',
      type: KEY_FUNCTION,
      config: true,
    },
    {
      name: 'webpack',
      type: KEY_WEBPACK,
      config: true,
    },
    {
      name: 'path',
      type: KEY_RPATH,
      value: page.relativePath,
      resolved: pagePath,
    },
    {
      name: 'shared',
      type: KEY_PAGE_PATH,
      value: '.shared',
      inherit: true,
    },
    // subfolders that will not be treated as sub page
    {
      name: 'ignore',
      type: KEY_STRING_ARRAY,
      config: true,
      default: [
        /tmp$/, /images$/, /img$/, /js$/, /script$/, /^_/, /css$/, /style$/,
        /lib$/, /reducers/, /node_modules/, /components/,
        /bower_components/, /coverage/, /^test$/, /^tests$/, /redux$/,
        /dist$/, /dev$/, /DS_Store/, /assets/, /^modules$/,
      ],
    },
    {
      name: 'distSubPath',
      value: 'public',
      type: KEY_STRING,
    },
    {
      name: 'methods',
      type: KEY_STRING_ARRAY,
      default: ['get', 'post', 'put', 'delete', 'all'],
      config: true,
    },
    {
      name: 'staticMain',
      type: KEY_STRING,
    },
    {
      name: 'rules',
      type: KEY_ARRAY,
      config: true,
      default: [],
    },
    {
      name: 'mount',
      type: KEY_BOOLEAN,
      config: true,
      default: true,
    },
    {
      name: 'entry',
      type: KEY_STRING_ARRAY,
      config: true,
      default: [],
    },
  ].map((opts) => this.createKey(opts.name, opts));
}

function createKey(name, key) {
  if (key.type && !allowedKeyTypes.includes(key.type)) {
    throw cannot('register', 'key')
      .because('type is not supported')
      .addInfo(`Supported Types are ${allowedKeyTypes}`);
  }

  // TODO: add rootOnly keys (will only be taken from the root .server)

  const baseKey = {
    type: KEY_STRING,
    inherit: false,
    value: null,
    store: true,
    config: false,
  };
  const newKey = {};

  _.extend(newKey, baseKey, {
    build: false,
    watch: false,
    distExt: null,
    // ENTRY_STATIC | ENTRY_DYNAMIC | null (not an entry point)
    // -> Determines if a key holds info about an entry point and how to build it
    entry: null,
  }, key, {
    name,
    cache: null,
  });

  if ([KEY_FILE_ARRAY, KEY_ARRAY, KEY_STRING_ARRAY].includes(newKey.type)) {
    if (!newKey.value) {
      Object.assign(newKey, { value: [] });
    }
  }

  return newKey;
}

function applyKeysToPage(page, keysToApply) {
  const keys = keysToApply.map((key) => {
    const newKey = _.cloneDeep(key);

    if (newKey.default && (!newKey.value || 
      (Array.isArray(newKey.value) 
        && newKey.value.length === 0) ||
      (typeof newKey.value === 'object' 
        && Object.keys(newKey.value) === 0)
    )) {
      const value = typeof newKey.default === 'function'
        ? newKey.default(page)
        : _.cloneDeep(newKey.default);
      delete newKey.default;
      Object.assign(newKey, { value });
    }

    if (page.hasOwnProperty(newKey.name)) {
      throw cannot('apply', 'key to page')
        .because('it already exists').addInfo(newKey.name);
    }

    Object.defineProperty(page, key.name, {
      get: () => newKey,
    });

    return newKey;
  });

  Object.assign(page, {
    keys: page.keys.concat(keys),
  });
}

function ensurePathAccess(pagePath) {
  try {
    fs.accessSync(pagePath, fs.F_OK | fs.R_OK);
  } catch (ex) {
    this.log.error(`FATAL: Page path "${pagePath}" not accessible.`, ex);
    process.exit(1);
  }
}

function checkPageAccess(page) {
  try {
    fs.accessSync(page.path.resolved, fs.F_OK | fs.R_OK);
    return true;
  } catch (ex) {
    return false;
  }
}

function createPage(pagePath, settings = {}) {
  this.ensurePathAccess(pagePath);

  const dirInfo = path.parse(pagePath);
  const name = dirInfo.name;

  // TODO: Warn when trying to parse a page outside of the root path(?)
  const relativePath = path.relative(this.rootPath, pagePath);

  // TODO: Use relative path as default route _if inside root path_
  const route = path.join('/', relativePath.replace('+', ':').replace('\\', '/'));

  const pagePrimitives = [
    'id', 'name', 'route', 'entryName', 'attitudes',
  ];
  const nonWritables = [
    'children', 'relativePath',
    'handledFiles', 'fileHandlers', 'greedy', 'fileConfig',
    'keys', 'has', 'set', 'assign',
  ];
  const primitiveSettings = _.pick(settings, pagePrimitives);
  const filteredSettings = _.omit(settings, nonWritables);

  const basePage = _.extend({
    // Primitive keys
    id: uuid.v1(),
    name,
    relativePath,
    route,
    entryName: [this.name.toLowerCase()].concat(relativePath.replace(/\/$/, '')
      .split(path.sep)).join('.').replace(/\.$/, ''),

    settings: filteredSettings,

    //
    // Page Props
    // TODO: move to default config keys
    commons: true,
    createEntry: true,
    inject: true,
    
    greedy: false,

    //
    // Move to attitudes
    basePath: '/',
    serveStatics: true,
    poweredBy: `aden ${this.version}`,

    noWatch: [
      /^\.git/, /node_modules/, /bower_components/, /tmp/, /^temp$/, /dist/,
    ],

    // Default Attitudes
    attitudes: _.uniq([
      'copy',
      'statuspages',
      'favicon',
      'html',
      'js',
      'css',
      'layout',
      'md',
      'hbs',
      'controller',
    ].concat(this.settings.attitudes)),

    // Internals
    fileConfig: {},
    children: [],
    handledFiles: {},
    fileHandlers: [],
    keys: [],
  }, primitiveSettings);

  this.extendPageWithMethods(basePage);

  const coreKeys = this.getCoreKeys(pagePath, basePage);
  this.applyKeysToPage(basePage, coreKeys);

  return basePage;
}

function extendPageWithMethods(page) {
  return _.extend(page, {
    has(keyName) {
      return this.keys.find((key) => (key.name === keyName));
    },
    set(keyName, value) {
      const changeKey = this.has(keyName);
      if (!changeKey) {
        throw cannot('set', 'the page key').because('it does not exist').addInfo(keyName);
      }
      Object.assign(changeKey, { value });
      return this;
    },
    assign(keyName, obj) {
      const changeKey = this.has(keyName);
      if (!changeKey) {
        throw cannot('assign', 'the page key').because('it does not exist').addInfo(keyName);
      }
      Object.assign(changeKey, obj);
    },
  });
}

function initFreshPageToParse(page) {
  return this.loadDotServerFile(page.path.resolved)
    .then((fileConfig) => {
      Object.assign(page, {
        fileConfig,
        attitudes: this.sortAttitudes(page.attitudes.concat(fileConfig.attitudes || [])),
      });
    })
    .then(() => this.loadAttitudes(page, page.attitudes))
    .then((attitudes) => {
      Object.assign(page, {
        activeAttitudes: attitudes,
      });
      attitudes.forEach((attitude) => attitude.applyTo(page));
    })
    .then(() => this.applyFileConfig(page.fileConfig, page))
    .then(() => Object.assign(page, { parsed: true }));
}

function initExistingPageToParse(page) {
  return Promise.resolve()
    .then(() => this.loadDotServerFile(page.path.resolved))
    .then((fileConfig) => {
      Object.assign(page, {
        fileConfig,
        // TODO: Reload attitudes
        attitudes: this.sortAttitudes(page.attitudes.concat(fileConfig.attitudes || [])),
      });
    })
    .then(() => this.applyFileConfig(page.fileConfig, page))
    .then(() => page);
}

function parsePage(basePage, parentPage) {
  if (!this.checkPageAccess(basePage)) {
    return Promise.resolve(Object.assign(basePage, {
      createEntry: false,
    }));
  }

  return Promise.resolve(basePage)
    .then((page) => (page.parsed
      ? this.initExistingPageToParse(page)
      : this.initFreshPageToParse(page)
    ))
    .then((page) => (parentPage ? this.inheritKeys(page, parentPage) : page))
    .then((page) => this.applyHook('pre:parse', { page }))
    .then(({ page }) => new Promise((resolve, reject) =>
      fs.readdir(page.path.resolved, (err, files) => {
        if (err) {
          reject(err);
        }
        resolve({ page, files });
      }))
    )
    .then(({ page, files }) => {
      this.log.start(`Parsing page ${page.entryName}`, { files });

      const parsedPage = files
        .filter((file) => file !== '.aden')
        .map((file) => {
          const fullFilePath = path.resolve(page.path.resolved, file);
          const fileStats = fs.statSync(fullFilePath);
          const fileInfo = path.parse(fullFilePath);

          // Add file type info to fileInfo for serialization
          const isDir = fileStats.isDirectory();

          return {
            fullFilePath,
            isDir,
            rpath: path.relative(this.rootPath, fullFilePath),
            name: fileInfo.name,
            file,
            dir: fileInfo.dir,
          };
        })
        .reduce((prev, fileInfo) => {
          if (fileInfo.isDir) {
            // Ignore as subpages
            const filterMatch = prev.ignore.value
              .find((value) => fileInfo.file.match(value));
            if (fileInfo.file.indexOf('.') === 0 || filterMatch) {
              this.log.debug(`IGNORED: "${fileInfo.file}" (config.ignore)`, { filterMatch });
              return prev;
            }

            // TODO: max recursive depth: 4 default

            // Go recursive, handle focus path
            if (!prev.focusPath || pathIsInside(
              fileInfo.fullFilePath,
              path.resolve(this.rootPath, prev.focusPath)
            )) {
              prev.children.push(this.registerPage(fileInfo.fullFilePath));
            }

            return prev;
          }

          // Remove fullFilePath as paths should be resolved relative to the root dir
          Object.assign(fileInfo, {
            fullFilePath: null,
          });

          // trigger file type handlers
          const handlers = page.fileHandlers.filter((handler) =>
            handler.matcher({ page: prev, fileInfo })
          );

          if (handlers.length > 0) {
            Object.assign(prev.handledFiles, {
              [fileInfo.file]: handlers,
            });
          }

          handlers.forEach((handler) => {
            // TODO: log attitudes that are handling the file
            this.log.info(`Handling file ${fileInfo.rpath}`);

            handler.fn.call(this, {
              page: prev,
              fileInfo,
              key: page[handler.keyName],
            });
          });

          return prev;
        }, page); // end files.reduce

      if (Object.keys(parsedPage.handledFiles).length === 0) {
        Object.assign(page, {
          route: false,
        });
      }

      return this.applyHook('post:parse', { page: parsedPage, files })
        .then((args) => {
          this.log.success(`Parsed page ${page.entryName}`);
          return args.page;
        });
    });
}

/**
 * The fileConfig comes from a .server file and should apply the config,
 * to registered config keys. All configuration coming from a .server file,
 * is not and should not be environmet specific. Only application specific settings,
 * that could go into a public repository should go there. Therefor, configuration
 * from a .server file, will not and should not be overriden by env vars.
 */
function applyFileConfig(fileConfig, page) {
  return Promise.resolve().then(() => {
    page.keys
      .filter((key) => key.config)
      .forEach((key) => page.set(key.name, key.type === KEY_OBJECT && fileConfig[key.name]
        ? _.merge(key.value || {}, fileConfig[key.name])
        : (fileConfig[key.name] || key.value)));

    // Special case -> Can be solved via key.config = (dotServerValue) => transform(dotServerValue)
    if (fileConfig.route) {
      Object.assign(page, {
        route: Array.isArray(fileConfig.route)
          ? fileConfig.route.map((route) => `/${page.relativePath}${route}`)
          : `/${page.relativePath}${fileConfig.route}`,
      });
    } else if (fileConfig.route === false) {
      // Setting page.route false should also not hook up any page controllers (GET, POST, etc.)
      // Sort out and document with `mount true/false`
      Object.assign(page, {
        route: false,
      });
    }

    if (fileConfig.attitudes) {
      Object.assign(page, {
        attitudes: _.uniq(_.merge(page.attitudes, fileConfig.attitudes, this.settings.attitudes)),
      });
    }

    return page;
  });
}

const pagesReducer = (pages, page) => {
  pages.push(page);
  if (page.children.length > 0) {
    page.children.reduce(pagesReducer, pages);
  }
  return pages;
};

function flattenPages(pages) {
  return pages.reduce(pagesReducer, []);
}

function inheritKeys(page, parentPage) {
  page.keys.forEach((key) => {
    if (!key.inherit) {
      if (key.type === KEY_FILE_ARRAY) {
        page.set(key.name, []);
      }
    } else {
      const parentKey = parentPage.has(key.name);
      if (parentKey) {
        page.set(key.name, _.cloneDeep(parentKey.value));
      }
    }
  });
  return page;
}

module.exports = {
  parsePage,
  flattenPages,
  applyFileConfig,
  createPage,
  createKey,
  inheritKeys,
  applyKeysToPage,
  getCoreKeys,
  initFreshPageToParse,
  initExistingPageToParse,
  extendPageWithMethods,
  ensurePathAccess,
  checkPageAccess,
};
