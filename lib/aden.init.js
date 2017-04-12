const path = require('path');
const _ = require('lodash');
const loggerMiddleware = require('morgan');
const Logger = require('./aden.logger');

process.__ADEN__ = false;

function init(rootPath) {
  try {
    const appPackageJson = require(path.resolve(rootPath, 'package.json')); // eslint-disable-line
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(rootPath).name.toUpperCase();
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

  // Access Log
  const log = loggerMiddleware(this.rootConfig.logger.format, {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.logger.info(buf);
      },
    },
  });

  // Apply default access logger
  this.rootConfig.logger = this.logger;
  this.app.use(log);

  this.logger.debug('Initializing Aden', rootPath, this.rootConfig);

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

  // Load plugins
  const pluginsPath = path.resolve(__dirname, 'plugins');

  const rootConfig = _.extend(this.rootConfig, {
    rootPath,
  });

  // TODO: Move initializers to api methods, what to run is decided by the cli
  //       Maybe aden.getTasks() -> ['build', 'clean', 'dev', 'web'] -> aden.run('build') (?)
  // TODO: Force build only to be production env
  if (rootConfig.buildOnly) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootConfig))
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

  if (rootConfig.cleanOnly) {
    return this.clean()
      .then(() => {
        this.logger.success('Clean up done. Exiting.');
        process.exit(0);
      });
  }

  if (this.isDEV) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootConfig))
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

  // > do not parse in production.
  return this.loadPlugins(pluginsPath)
    .then(() => this.load(rootConfig))
    .then(({ pages }) => {
      // TODO: get rid of this.rootPage, use pages[0]
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return { pages };
    })
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

module.exports = {
  init,
};
