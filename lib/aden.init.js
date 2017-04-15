const path = require('path');
const _ = require('lodash');
const loggerMiddleware = require('morgan');
const Logger = require('./aden.logger');
const cannot = require('cannot');
const packageJson = require('../package.json');

process.__ADEN__ = false;

function buildTask() {
  // TODO: Force build only to be production env
  return this.loadPages(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfig }) => {
      // TODO: get rid of this.rootPage, use pages[0]
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages, webpackConfig };
    })
    .then(({ pages, webpackConfig }) =>
      this.clean(pages)
      .then(() => this.build(pages, webpackConfig))
    )
    .then(() => {
      this.logger.success('Build only done. Exiting.');
      process.exit(0);
    });
}

function cleanTask() {
  return this.clean()
    .then(() => {
      this.logger.success('Clean up done. Exiting.');
      process.exit(0);
    });
}

function runDevTask() {
  return this.loadPages(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfig }) => {
      // TODO: get rid of this.rootPage, use pages[0]
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages, webpackConfig };
    })
    .then(({ pages, webpackConfig }) =>
      this.clean(pages)
      .then(() => this.build(pages, webpackConfig))
    )
    .then(({ pages }) => this.setupDev(pages[0]))
    .then(() => this.setupApp(this.rootPage))
    .then(() => this);
}

function runProductionTask() {
  return this.loadBuild(this.rootConfig)
    .then((pages) => this.setup(pages))
    .then(({ pages }) => {
      // TODO: get rid of this.rootPage, use pages[0]
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages };
    })
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

function init(rootPath, focusPath) {
  try {
    const appPackageJson = require(path.resolve(rootPath, 'package.json'));
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(rootPath).name.toUpperCase();
  }

  this.version = packageJson.version;

  this.logger = (new Logger(Object.assign(this.config.logger, {
    name: this.name,
  }))).fns;

  // Access Log
  const log = loggerMiddleware(this.config.logger.format, {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.logger.info(buf);
      },
    },
  });

  // Apply default access logger
  this.app.use(log);

  this.logger.debug('Initializing Aden', {
    rootPath, focusPath, config: this.config,
  });

  // This is what .aden extends as root page and app level configuration.
  const basePage = {
    //
    // Page Props
    path: '',
    focusPath: focusPath === true ? '' : focusPath,

    // TODO: write tests for routes...
    route: '/',

    shared: '.shared',
    dist: '.dist',

    get: null,
    post: null,
    put: null,
    delete: null,

    // client: false // Deactivate default client delivery
    // client: '.client.js'
    // To extend the default setup at lib/client ?

    commons: true,
    createEntry: true,

    // TODO: move to html extension
    inject: true,

    greedy: false,

    //
    // App Options
    basePath: '/',
    publicPath: '/',
    serveStatics: true,
    favicon: path.resolve(__dirname, '../assets/favicon.ico'),
    poweredBy: `aden ${this.version}`,

    defaults: path.resolve(__dirname, 'pages'),
    useDefaults: true,
    // TODO: (should) Error pages in subpaths override the parent level ones(?)
    error: 'error',
    notFound: '404',

    // subfolders that will not be treated as sub page
    // TODO: require sub pages to have a .aden file(?) maybe as a setting, default not required
    ignore: [
      /tmp/, /images/, /img/, /js/, /script/, /^_/, /css/, /style/,
      /lib/, /reducers/, /node_modules/, /components/,
      /bower_components/, /coverage/, /test/, /tests/, /redux/,
      /dist/, /dev$/, /DS_Store/, /assets/, /^modules$/,
    ],
    // TODO: Load this from page config as well (merge)
    noWatch: [
      /git/, /node_modules/, /tmp/, /temp/, /dist/,
    ],

    // Build
    entryNameDelimiter: '.',

    // Make sure this cannot be overriden from external configs
    children: [],
    logger: this.logger,
  };

  if (process.__ADEN__) {
    this.logger.warn('Only call init() once. Only run one aden instance per process.');
    process.exit(1);
  }

  process.__ADEN__ = true;

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
  };

  return this.loadAdenFile(rootPath, true)
    .then((fileConfig) => {
      this.rootConfig = _.extend(basePage, _.pick(fileConfig, [
        'defaults', 'error', 'notFound', 'shared', 'name',
      ]), {
        rootPath,
      });
      return this.rootConfig;
    })
    .then((rootPage) => this.resolvePaths(rootPage.rootPath, rootPage))
    .then((rootPage) => this.loadExtensions(this.config.pluginsPath).then(() => rootPage))
    .then((rootPage) => {
      // apply keys to rootPage
      this.keys.forEach((key) => {
        // TODO: check if the key already exists
        Object.assign(rootPage, {
          [key.name]: rootPage[key.name] || key.default || null,
        });
      });
    })
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

module.exports = {
  init,
  run,
};
