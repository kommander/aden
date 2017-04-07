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
      .then(() => this.build(true))
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
      .then(() => this.build(true))
      .then(() => this.setupDev())
      .then(() => this.setupApp(this.rootPage))
      .then(() => this);
  }

  // TODO: In Production make sure we have a .build file in the .dist folder,
  //       with build info, marked as production build.
  // TODO: In production use precompiled page tree info from the .build file,
  //       > do not parse in production.
  return this.loadPlugins(pluginsPath)
    .then(() => this.load(rootPath))
    .then(() => this.setupApp(this.rootPage))
    .then(() => this);
}

module.exports = {
  init,
};
