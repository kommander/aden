const path = require('path');
const _ = require('lodash');
const loggerMiddleware = require('morgan');
const cannot = require('brokens');
const packageJson = require('../package.json');

const adenConstants = require('./aden.constants.js');
const {
  KEY_TYPE_FUNCTION,
  KEY_TYPE_WEBPACK,
  KEY_TYPE_RPATH,
  KEY_TYPE_PAGE_PATH,
  KEY_TYPE_STRING_ARRAY,
  KEY_TYPE_ARRAY,
  KEY_TYPE_APATH,
} = adenConstants;

process.__ADEN__ = false;

function buildTask() {
  // TODO: Force build only to be production env
  return this.loadPages(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfigs }) => {
      // TODO: This is so messed up still...
      // We need to know the rootpage for development,
      // and default pages for setup.
      // Can be reduced by dev using hooks to select the rootpage.
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages, webpackConfigs };
    })
    .then(({ pages, webpackConfigs }) =>
      this.clean(pages)
        .then(() => this.build(pages, webpackConfigs))
    )
    .then(() => this);
}

function cleanTask() {
  return this.clean()
    .then(() => this);
}

function runDevTask() {
  return this.loadPages(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfigs }) => {
      // TODO: get rid of this.rootPage, use pages[0]
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages, webpackConfigs };
    })
    .then(({ pages, webpackConfigs }) =>
      this.clean(pages)
      .then(() => this.build(pages, webpackConfigs))
    )
    .then(({ pages, webpackConfigs }) => this.setupDev(pages, webpackConfigs))
    .then(({ pages }) => this.runStartupCallback({ pages }))
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

function runProductionTask() {
  return this.loadBuild(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => {
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages };
    })
    .then(({ pages }) => this.runStartupCallback({ pages }))
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

function runDeployTask(opts = {}) {
  return this.loadBuild(this.rootConfig)
    .then((pages) => {
      const target = opts.target || 'default';
      const targetFn = (this.deployTargets[target] || {}).fn;
      if (!targetFn) {
        this.log.warn(`No deploy target for ${target}`);
        return { pages, target };
      }

      return Promise.resolve()
        .then(() => this.applyHook('pre:deploy', { pages, target }))
        .then(() => this.applyHook('deploy', { pages, target }))
        .then((args) => targetFn(args))
        .then(() => this.applyHook('post:deploy', { pages, target }));
    })
    .then(() => this);
}

function init(initPath, focusPath) {
  if (process.__ADEN__) {
    throw new Error('Fatal: Only call aden.init() once per process.');
  }
  process.__ADEN__ = true;

  const rootPath = this.rootPath = path.resolve(initPath);

  try {
    const appPackageJson = require(path.resolve(rootPath, 'package.json'));
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(rootPath).name.toUpperCase();
  }

  this.version = packageJson.version;

  // Access Log
  const log = loggerMiddleware(this.settings.logger.format, {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.log.info(buf);
      },
    },
  });

  // Apply default access logger
  this.app.use(log);

  this.log.debug('Initializing Aden', {
    rootPath, focusPath, settings: this.settings,
  });

  // The exposed interface for hooks, events and callbacks (startup)
  this.ui = _.extend({
    registerFile: (...args) => { this.registerFile.apply(this, args); return this.ui; },
    registerFiles: (...args) => { this.registerFiles.apply(this, args); return this.ui; },
    registerKey: (...args) => { this.registerKey.apply(this, args); return this.ui; },
    hook: (...args) => { this.hook.apply(this, args); return this.ui; },
    loadCustom: this.loadCustom.bind(this),
    log: this.log.namespace(this.name),
    constants: adenConstants,
  }, _.pick(this, [
    'name', 'app', 'version', 'rootPath', 'rootPage', 'walkPages',
    'isDEV', 'isPROD', 'flattenPages', 'server', 'settings',
  ]));

  // This is what .aden extends as root page and app level configuration.
  const basePage = {
    //
    // Page Props
    relativePath: '',
    focusPath: focusPath || false,

    route: '/',

    // TODO: move to default config keys
    commons: true,
    createEntry: true,
    inject: true,
    greedy: false,

    //
    // App Options
    basePath: '/',
    publicPath: '/',
    serveStatics: true,
    poweredBy: `aden ${this.version}`,

    useDefaults: true,
    // TODO: (should) Error pages in subpaths override the parent level ones(?)
    error: '500',
    notFound: '404',

    // subfolders that will not be treated as sub page
    // TODO: require sub pages to have a .aden file(?) maybe as a setting, default not required
    // TODO: Use .gitignore
    ignore: [
      /tmp/, /images/, /img/, /js/, /script/, /^_/, /css/, /style/,
      /lib/, /reducers/, /node_modules/, /components/,
      /bower_components/, /coverage/, /^test$/, /^tests$/, /redux/,
      /dist/, /dev$/, /DS_Store/, /assets/, /^modules$/,
    ],
    // TODO: Load this from page config as well (merge)
    // TODO: load .gitignore and ignore those as well
    noWatch: [
      /^\.git/, /node_modules/, /bower_components/, /tmp/, /^temp$/, /dist/,
    ],

    // Build
    entryNameDelimiter: '.',

    children: [],
    log: this.log,

    key: {},
    keys: [],
    fileConfig: {},

    // Default Attitudes
    attitudes: [
      'favicon',
      'html',
      'js',
      'css',
      'layout',
      'md',
      'hbs',
      'controller',
    ],
  };

  // TODO: shortpath this.registerKeys([{}, {}, {}])
  // Default keys
  this
    .registerKey('startup', {
      type: KEY_TYPE_FUNCTION,
      config: true,
    })
    .registerKey('webpack', {
      type: KEY_TYPE_WEBPACK,
      config: true,
    })
    .registerKey('path', {
      type: KEY_TYPE_RPATH,
      value: '',
    })
    .registerKey('shared', {
      type: KEY_TYPE_PAGE_PATH,
      value: '.shared',
      inherit: true,
    })
    .registerKey('ignore', {
      type: KEY_TYPE_STRING_ARRAY,
      config: true,
      default: [],
    })
    .registerKey('rules', {
      type: KEY_TYPE_ARRAY,
      config: true,
      default: [],
    })
    .registerKey('defaults', {
      type: KEY_TYPE_APATH,
      config: true,
      resolve: (aden) => aden.settings.defaults || path.resolve(__dirname, 'pages'),
    });

  // TODO: use hooks from dev setup to apply
  if (this.isDEV) {
    this.app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });
  }

  this.tasks = {
    build: buildTask,
    clean: cleanTask,
    dev: runDevTask,
    production: runProductionTask,
    deploy: runDeployTask,
  };

  return this.loadAdenFile(rootPath, true)
    .then((fileConfig) => {
      // Config values that can only be set once by the root config
      this.rootConfig = _.extend(basePage, _.pick(fileConfig, [
        'error', 'notFound', 'shared',
      ]), {
        rootPath,
        dist: path.resolve(rootPath, fileConfig.dist || '.dist'),
        attitudes: _.merge(basePage.attitudes, fileConfig.attitudes, this.settings.attitudes),
      });
      return this.rootConfig;
    })
    .then((rootPage) =>
      this.loadAttitudes(this.settings.attitudesPath, rootPage.attitudes)
      .then(() => rootPage))
    .then((rootPage) => this.applyHook('init', { rootPage, aden: this }))
    .then(({ rootPage }) => this.applyKeys(rootPage, this.keys))
    .then((rootPage) => this.resolvePaths(rootPath, rootPage))
    .then(() => this);
}

function run(task, opts) {
  return Promise.resolve().then(() => {
    const taskFn = this.tasks[task];
    if (!taskFn) {
      throw cannot('run', task).because('it does not exist');
    }
    return taskFn.call(this, opts);
  });
}

function runStartupCallback({ pages }) {
  if (typeof pages[0].key.startup.value === 'function') {
    return Promise.resolve()
      .then(() => pages[0].key.startup.value(this.ui))
      .then(() => ({ pages }));
  }
  return Promise.resolve({ pages });
}

module.exports = {
  init,
  run,
  runStartupCallback,
};
