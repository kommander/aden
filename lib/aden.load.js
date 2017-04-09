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
      if (process.env.NODE_ENV === 'development' || this.rootConfig.buildOnly) {
        return this.loadPages();
      }
      return this.loadBuild();
    })
    .then((pages) => this.executeDotFiles(pages))
    .then((pages) => this.postLoadWalk(pages))
    .then((pages) => this.executeHook('post:load', { pages }));
}

// Iterate loaded file tree,
// page attributes/methods that are generated from props should go here
function postLoadWalk(pages) {
  return this.walkPages(pages, this.rootConfig, 'pre:walk', 'post:walk', (page, parentPage) =>
    Object.assign(page, {
      templateEngine: page.templateEngine
        || parentPage.templateEngine
        || this.getDefaultTemplateEngine(),
      loadData: this.emptyData,
      render: page.render || (page.template ? this.getDefaultRender() : null),
      htmlFile: page.template ? `${page.entryName}.html` : null,
      htmlFileFullPath: page.template ? path.resolve(
        this.rootConfig.dist,
        `${page.entryName}.html`
      ) : null,
    })
  );
}

// Parse Pages from file tree
// TODO: take rootPage as argument
function loadPages() {
  this.logger.info('Setting up page parser');

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
}

// Iterate over pages and found dot files, execute hooks
function executeDotFiles(pages) {
  const promises = this.reducePages(pages)
    .filter((page) => page.dotFiles.length > 0)
    .map((page) => page.dotFiles.map((file) => Promise.resolve().then(() => {
      const { fullFilePath, fileInfo } = file;
      if (fileInfo.isDir) {
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
  return Promise.all(promises)
    .then(() => pages);
}

// Load pages from dist build (pages.stats.json)
function loadBuild() {
  this.logger.start('Loading build files');

  return Promise.resolve().then(() => {
    const webpackStats = require(this.webpackStatsDist);
    this.webpackStats = webpackStats;
    const pages = require(this.pageStatsDist);

    this.logger.start('Done loading build files');

    return pages;
  });
}

// Async iterate over nested pages
function walkPages(pages, parentPage, preHook, postHook, cb) {
  return Promise.all(pages.map((page) =>
    (preHook
      ? this.executeHook(preHook, { page, parentPage })
      : Promise.resolve({ page, parentPage }))
      .then((hooked) => cb(hooked.page, hooked.parentPage))
      .then((result) => this.walkPages(result.children || [], result, preHook, postHook, cb)
        .then((children) => Object.assign(result, { children }))
      )
      .then((walkedPage) =>
        (postHook
          ? this.executeHook(postHook, { page: walkedPage })
            .then((hooked) => hooked.page)
          : Promise.resolve(walkedPage)
        )
      )
  ));
}

// All paths are relative to the app root we are currently running,
// this resolves all paths for a page.
function resolvePaths(page) {
  Object.keys(page)
    .filer((key) =>
      [
        'path',
        'dist',
      ]
    )
}

module.exports = {
  load,
  loadBuild,
  loadPages,
  executeDotFiles,
  walkPages,
  postLoadWalk,
  resolvePaths,
};
