const path = require('path');

const DEV_ENV = process.env.NODE_ENV === 'development';

// All apps intialized in this process
const allApps = [];

function init() {
  this.logger.info('Initializing Aden', this.rootConfig);

  if (allApps.indexOf(this) !== -1) {
    this.logger.warn('This instance was already initialized. Only call init() once.');
    process.exit(1);
  }

  const rootPath = this.rootConfig.path;

  // TODO: (must) Warn if basePaths of added apps collide
  this.allApps = allApps;
  allApps.push(this);
  this.allAppsPosition = allApps.length;

  // Load plugins
  // TODO: When plugin api is stable, use plugins from pages as well
  const pluginsPath = path.resolve(__dirname, 'plugins');

  if (this.rootConfig.allowProgramOptions && this.app.program.install && this.app.program.build) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(() => this.installPage(this.rootPage))
      .then(() => this.build(true))
      .then(() => {
        this.logger.debug('Install & build only done. Exiting.');
        process.exit(0);
      });
  }

  if (this.rootConfig.allowProgramOptions && this.app.program.install) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(() => this.installPage(this.rootPage))
      .then(() => {
        this.logger.debug('Install only done. Exiting.');
        process.exit(0);
      });
  }

  if (this.rootConfig.allowProgramOptions && this.app.program.build) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(() => this.build(true))
      .then(() => {
        this.logger.debug('Build only done. Exiting.');
        process.exit(0);
      });
  }

  if (DEV_ENV) {
    return this.loadPlugins(pluginsPath)
      .then(() => this.load(rootPath))
      .then(() => this.build(true))
      .then(() => this.setupDev())
      .then(() => this.setupApp(this.rootPage));
  }

  // TODO: In Production make sure we have a .build file in the .dist folder,
  //       with build info, marked as production build.
  // TODO: In production use precompiled page tree info from the .build file,
  //       > do not parse in production.
  return this.loadPlugins(pluginsPath)
    .then(() => this.load(rootPath))
    .then(() => this.setupApp(this.rootPage));
}

module.exports = {
  init,
};
