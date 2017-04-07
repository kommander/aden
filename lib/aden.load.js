const path = require('path');
const conflate = require('conflate');
const fs = require('fs');

// TODO: Take rootConfig as argument instead of using this.rootConfig
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

      // TODO: This is a workaround to handle dotfiles after parsing and webpack config
      return this.generateWebpackConfig(pages)
        .then((webpackConfig) => this.updatePageConfigs(pages, webpackConfig))
        .then(() => {
          const promises = this.reducePages(pages)
            .filter((page) => page.dotFiles.length > 0)
            .map((page) =>
              page.dotFiles.map((file) => Promise.resolve().then(() => {
                // console.log('DOTFILE', file);
                const { fileStats, fullFilePath, fileInfo } = file;
                if (fileStats.isDirectory()) {
                  if (file === page.renderDir) {
                    // TODO: load files async
                    // TODO: !!! initialize render, data, plugins after all pages are parsed,
                    //       to allow a renderer to have access to all routes and webpack info on setup.
                    const customRender = this.loadCustom(
                      path.resolve(fullFilePath, 'index.js')
                    );
                    page.render = customRender || page.render;
                  } else if (file === page.dataDir) {
                    const customData = this.loadCustom(
                      path.resolve(fullFilePath, 'index.js')
                    );
                    page.loadData = customData || page.loadData;
                  }
                } else {
                  if (fileInfo.base === page.renderFile) {
                    const customRender = this.loadCustom(fullFilePath);
                    page.render = customRender || page.render;
                  } else if (fileInfo.base === page.dataFile) {
                    const customData = this.loadCustom(fullFilePath);
                    page.loadData = customData || page.loadData;
                  } else if (fileInfo.base === page.templateEngineFile) {
                    const customTemplateEngine = this.loadCustom(fullFilePath);
                    page.templateEngine = customTemplateEngine || page.templateEngine;
                  }
                }
              }))
            );
          return Promise.all(promises);
        });
    })
    .then(() => this.executeHook('post:load', { aden: this }));
}

module.exports = {
  load,
};
