const path = require('path');
const DEV_ENV = process.env.NODE_ENV === 'development';

process.__ADEN__ = false;

function init() {
  this.logger.info('Initializing Aden', this.rootConfig);

  if (process.__ADEN__) {
    this.logger.warn('Only call init() once. Only run one aden instance per process.');
    process.exit(1);
  }

  process.__ADEN__ = true;

  const rootPath = this.rootConfig.path;

  // Load plugins
  // TODO: When plugin api is stable, use plugins from pages as well
  const pluginsPath = path.resolve(__dirname, 'plugins');

  if (this.rootConfig.buildOnly) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(({ pages }) => this.generateWebpackConfig(pages))
      .then(({ pages, webpackConfig }) => {
        // TODO: get rid of this.rootPage, use pages[0]
        this.rootPage = pages[0];
        this.defaultPages = [pages[1], pages[2]];
        return { pages, webpackConfig };
      })
      .then(({ pages, webpackConfig }) => this.build(pages, webpackConfig, true))
      .then(() => {
        this.logger.success('Build only done. Exiting.');
        process.exit(0);
      });
  }

  if (this.rootConfig.cleanOnly) {
    return this.clean()
      .then(() => {
        this.logger.success('Clean up done. Exiting.');
        process.exit(0);
      });
  }

  if (DEV_ENV) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(({ pages }) => this.generateWebpackConfig(pages))
      .then(({ pages, webpackConfig }) => {
        // TODO: get rid of this.rootPage, use pages[0]
        this.rootPage = pages[0];
        this.defaultPages = [pages[1], pages[2]];
        return { pages, webpackConfig };
      })
      .then(({ pages, webpackConfig }) => this.build(pages, webpackConfig, true))
      .then(() => this.setupDev())
      .then(() => this.setupApp(this.rootPage))
      .then(() => this);
  }

  // > do not parse in production.
  return this.loadPlugins(pluginsPath)
    .then(() => this.load(rootPath))
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
