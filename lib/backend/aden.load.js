const path = require('path');
const conflate = require('conflate');
const fs = require('fs');

function load(rootPath) {
  this.logger.info('Loading up app');

  return this.loadAdenFile(rootPath, true)
    .then((fileConfig) => {
      this.rootConfig.pagesPath = path.resolve(rootPath, fileConfig.pagesPath || '');
    })
    .then(() => this.executeHook('pre:load', { aden: this }))
    .then(() => {
      const errPagePath = path.resolve(this.rootConfig.defaults, this.rootConfig.error);
      const errPage = this.parsePage(
        errPagePath,
        this.rootConfig
      );

      const notFoundPagePath = path.resolve(this.rootConfig.defaults, this.rootConfig.notFound);
      const notFoundPage = this.parsePage(
        notFoundPagePath,
        this.rootConfig
      );
      const rootParent = conflate({}, this.rootConfig, { root: true });

      try {
        fs.accessSync(this.rootConfig.pagesPath, fs.F_OK | fs.R_OK);
      } catch (ex) {
        this.logger.error(`FATAL: Pages path "${this.rootConfig.pagesPath}" not accessible!`); // eslint-disable-line
        process.exit(1);
      }

      const rootPage = this.parsePage(this.rootConfig.pagesPath, rootParent);

      return Promise.all([rootPage, errPage, notFoundPage]);
    })
    .then((pages) => {
      this.rootPage = pages[0];
      this.defaultPages = [pages[1], pages[2]];
      return pages;
    })
    .then((pages) => this.generateWebpackConfig(pages))
    .then(() => this.executeHook('post:load', { aden: this }));
}

module.exports = {
  load,
};
