'use strict';

const path = require('path');
const conflate = require('conflate');
const fs = require('fs');

const HtmlWebpackPlugin = require('html-webpack-plugin');

const DEV_ENV = process.env.NODE_ENV === 'development';

function parsePage(pagePath, maybeParentPage) {
  return Promise.resolve().then(() => {
    this.logger.start(`Parsing page ${pagePath}`, { pagePath, maybeParentPage });

    const parentPage = maybeParentPage || {};
    const dirInfo = path.parse(pagePath);
    const name = dirInfo.name;

    const page = {
      name,
      path: pagePath,
      dirInfo,
      parentPage,
      basePath: parentPage.basePath.slice(-1) !== '/' ?
        `${parentPage.basePath}/` : parentPage.basePath,
      route: parentPage.route.slice(-1) !== '/' ?
        `${parentPage.route}/${name}` : `/${!parentPage.root ? name : ''}`,
      entryName: (parentPage.entryName ?
        parentPage.entryName + parentPage.entryNameDelimiter : '')
          + name.replace(parentPage.entryNameDelimiter, ''),
      createEntry: !!parentPage.createEntry,
      inject: parentPage.inject,
      children: [],
      indexFile: parentPage.indexFile,
      templateFile: parentPage.templateFile,
      styleFile: parentPage.styleFile,
      template: null,
      index: null,
      style: null,
      templateEngine: parentPage.templateEngine || this.getDefaultTemplateEngine(),
      templateEngineFile: parentPage.templateEngineFile,
      loadData: this.emptyData,
      dataDir: parentPage.dataDir,
      dataFile: parentPage.dataFile,
      render: null, // A renderer will only be assigned if there is a template file
      renderDir: parentPage.renderDir,
      renderFile: parentPage.renderFile,
      commons: !!parentPage.commons,
      serveStatics: !!parentPage.serveStatics,
      shared: parentPage.shared,
      entryNameDelimiter: parentPage.entryNameDelimiter,
      ignore: parentPage.ignore,
      noWatch: parentPage.noWatch,
      greedyRoutes: false, // Do not inherit greedy routes

      subpagePaths: [],
      dotFiles: [],
    };

    return this.loadAdenFile(pagePath)
      .then((fileConfig) => {
        conflate(page, fileConfig, {
          dist: parentPage.dist,
        },
        // TODO: Separate settings from actual page features/attributes (overridable and non-overridable)
        ['sharedPath', 'entryName', 'route', 'dirInfo',
          'path', 'template', 'index', 'style', 'entryNameDelimiter',
          'children', 'loadData', 'render', 'htmlFile', 'htmlFileFullPath',
          'entry', 'middlewaresAvailable', 'loaders']);

        // Resolve paths
        page.sharedPath = path.resolve(page.path, page.shared);

        // Add webpack loaders
        if (fileConfig.loaders && fileConfig.loaders.length) {
          Array.prototype.push.apply(this.pageWebpackLoaders, fileConfig.loaders);
        }
      })
      .then(() => this.executeHook('pre:parse', { page, parentPage }))
      .then(() => new Promise((resolve, reject) => fs.readdir(pagePath, (err, files) => {
        if (err) {
          reject(err);
        }
        resolve(files);
      })))
      .then((files) => {
        this.logger.debug(`Page parse files: ${files}`);

        const parsedPage = files.reduce((prev, file) => {
          const fullFilePath = path.resolve(pagePath, file);
          const fileStats = fs.statSync(fullFilePath);
          const fileInfo = path.parse(fullFilePath);

          // Handle dot files
          // TODO: Reload dot files on change during dev
          if (fileInfo.name.indexOf('.') === 0 && file !== '.aden') {
            prev.dotFiles.push({
              file,
              fullFilePath,
              fileStats,
              fileInfo,
            });
            return prev;
          }

          if (fileStats.isDirectory()) {
            // Ignore as subpages
            const filterMatches = prev.ignore.filter((value) => file.match(value));
            if (filterMatches.length !== 0) {
              this.logger.debug(`IGNORED: "${file}" (config.ignore)`);
              return prev;
            }

            // Go recursive
            prev.subpagePaths.push(fullFilePath);
            return prev;
          } else if (fileStats.isFile()) {
            // Check for explicit entry points
            if (file === prev.indexFile) {
              return Object.assign(prev, { index: fullFilePath });
            } else if (file === page.templateFile) {
              return Object.assign(prev, { template: fullFilePath });
            } else if (file === prev.styleFile) {
              return Object.assign(prev, { style: fullFilePath });
            }
          }

          return prev;
        }, page); // end files.reduce

        if (parsedPage.template) {
          parsedPage.render = parentPage.render || this.getDefaultRender();
        }

        const dotFileHooks = parsedPage.dotFiles.map(({
          file, fullFilePath, fileStats, fileInfo,
        }) => this.executeHook('parse:dot', {
          page: parsedPage, parentPage: parsedPage.parentPage,
          fileInfo, file, fileStats, fullFilePath,
        }));

        return Promise.all(dotFileHooks)
          .then(() => {
            const subpages = parsedPage.subpagePaths.map((filePath) =>
              this.parsePage(filePath, parsedPage)
            );
            return Promise.all(subpages);
          })
          .then((childPages) => {
            Array.prototype.push.apply(parsedPage.children, childPages);
          })
          .then(() => this.executeHook('post:parse', { page: parsedPage, parentPage }))
          .then(() => {
            this.logger.success(`Parsed page ${pagePath}`, { page: parsedPage });
            // TODO: return immutable page settings
            return parsedPage;
          });
      });
  });
}

function updatePageConfigs(pages, webpackConfig) {
  const updates = pages.map((page) => this.updatePageConfig(page, webpackConfig));
  return Promise.all(updates);
}

function updatePageConfig(page, webpackConfig) {
  return Promise.resolve()
    .then(() => this.preparePageEntry(page))
    .then(webpackEntry => {
      if (webpackEntry) {
        const entryName = page.entryName;

        webpackConfig.entry[entryName] = webpackEntry;
      }

      if (page.htmlPlugin) {
        webpackConfig.plugins.push(page.htmlPlugin);
        if (this.compiler) {
          this.compiler.apply(page.htmlPlugin);
        }
      }

      const configs = [];
      // TODO: use map
      for (let i = 0; i < page.children.length; i++) {
        const childPage = page.children[i];
        configs.push(this.updatePageConfig(childPage, webpackConfig));
      }
      return Promise.all(configs);
    });
}

const pagesReducer = (prev, page) => {
  prev.push(page);
  if (page.children.length > 0) {
    page.children.reduce(pagesReducer, prev);
  }
  return prev;
};

function reducePages(pages) {
  return pages.reduce(pagesReducer, []);
}

function preparePageEntry(page) {
  this.logger.start(`Preparing entry point for ${page.route} (${page.name})`, { page });

  if (page.createEntry === false || (!page.htmlFileFullPath && !page.render && !page.index)) {
    return null;
  }

  // Push client entry point to beginning
  const webpackEntry = [
    path.resolve(__dirname, './client/index.js'),
  ];

  if (DEV_ENV) {
    // TODO: Make it work without reload
    webpackEntry.unshift(`webpack-hot-middleware/client?reload=true&path=${this.hmrPath}`);
  }

  return Promise.resolve({ entry: webpackEntry, page })
    .then(args => this.executeHook('pre:entry', args))
    .then(args => {
      const entry = args.entry;

      if (page.index) {
        entry.push(page.index);
      }

      // Provide template with bundle
      // TODO: Only include template with bundle optionally,
      //       just included now to trigger a browser reload when template is changed
      if (page.template) { // && page.bundleTemplate === true) {
        entry.push(page.template);
      }

      if (page.style) {
        entry.push(page.style);
      }

      // TODO: Provide copyFiles again, to be extended with hooks/config per page

      const chunks = [page.entryName];
      if (page.commons) {
        chunks.unshift('commons');
      }

      if (page.template) {
        page.htmlFile = `${page.entryName}.html`; // eslint-disable-line
        page.htmlFileFullPath = path.resolve( // eslint-disable-line
          page.dist,
          page.htmlFile
        );
        page.htmlPlugin = new HtmlWebpackPlugin({ // eslint-disable-line
          template: page.template,
          filename: `../${page.htmlFile}`,
          chunks,
          inject: page.inject,
          cache: !DEV_ENV,
          title: page.title || page.name,
        });
      }

      page.entry = entry; // eslint-disable-line

      return { entry };
    })
    .then(args => this.executeHook('post:entry', args))
    .then(args => args.entry)
    .catch(err => {
      this.logger.warn('PreparePageEntry Error', { page }, err);
    });
}

module.exports = {
  parsePage,
  updatePageConfig,
  updatePageConfigs,
  preparePageEntry,
  reducePages,
};
