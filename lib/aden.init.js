const path = require('path');
const _ = require('lodash');

process.__ADEN__ = false;

function init(rootPath) {
  this.logger.debug('Initializing Aden', rootPath, this.rootConfig);

  if (process.__ADEN__) {
    this.logger.warn('Only call init() once. Only run one aden instance per process.');
    process.exit(1);
  }

  process.__ADEN__ = true;

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
