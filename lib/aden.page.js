'use strict';

const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const _ = require('lodash');

const HtmlWebpackPlugin = require('html-webpack-plugin');

function parsePage(pagePath, maybeParentPage) {
  return Promise.resolve().then(() => {
    this.logger.start(`Parsing page ${pagePath}`, {
      maybeParentPage: _.pick(maybeParentPage, [
        'id',
        'name',
        'route',
        'path',
      ]),
    });

    const parentPage = maybeParentPage || {};
    const dirInfo = path.parse(pagePath);
    const name = dirInfo.name;

    // TODO: Warn when path was already parsed
    // TODO: Warn when trying to parse a page outside of the root path
    const relativePath = path.relative(this.rootConfig.path, pagePath);

    // TODO: Use relative path as default route if inside root path
    const route = `/${relativePath}` || '/';

    // TODO: use a merge function with optional triggers for keys (lodash? conflate?)
    const page = {
      id: uuid.v1(),
      name,
      path: pagePath,
      relativePath,
      dirInfo,
      basePath: parentPage.basePath.slice(-1) !== '/' ?
        `${parentPage.basePath}/` : parentPage.basePath,
      route,
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
      templateEngineFile: parentPage.templateEngineFile,
      templateEngine: null,
      dataDir: parentPage.dataDir,
      dataFile: parentPage.dataFile,
      send: null, // A sender will only be assigned if there is a template file
      sendDir: parentPage.sendDir,
      sendFile: parentPage.sendFile,
      commons: !!parentPage.commons,
      serveStatics: !!parentPage.serveStatics,
      shared: parentPage.shared,
      entryNameDelimiter: parentPage.entryNameDelimiter,
      ignore: parentPage.ignore,
      noWatch: parentPage.noWatch,
      greedy: route.match(/\*/),

      subpagePaths: [],
      dotFiles: [],
    };

    return this.loadAdenFile(pagePath)
      .then((fileConfig) => {
        // TODO: Separate settings from actual page features/attributes
        //       (overridable and non-overridable)
        _.merge(
          page,
          {
            dist: parentPage.dist,
          }, _.omit(fileConfig, [
            'id', 'sharedPath', 'entryName', 'dirInfo',
            'path', 'template', 'index', 'style', 'entryNameDelimiter',
            'children', 'loadData', 'htmlFile', 'htmlFileFullPath',
            'entry', 'middlewaresAvailable', 'loaders', 'logger',
          ])
        );

        // Resolve paths
        page.sharedPath = path.resolve(page.path, page.shared);

        // Add webpack loaders
        // TODO: Move this to post load walk to load in production (loadBuild)
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

          // Add file type info to fileInfo for serialization
          fileInfo.isDir = fileStats.isDirectory();

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

            // favicon
            if (file === 'favicon.ico') {
              return Object.assign(prev, { favicon: fullFilePath });
            }
          }

          // TODO: Warn when finding .dist folders (which should only be on root level)

          return prev;
        }, page); // end files.reduce

        const dotFileHooks = parsedPage.dotFiles.map(({
          file, fullFilePath, fileStats, fileInfo,
        }) => this.executeHook('parse:dot', {
          page: parsedPage, parentPage,
          fileInfo, file, fileStats, fullFilePath,
        }));

        return Promise.all(dotFileHooks)
          .then(() => this.executeHook('post:parse', { page: parsedPage, parentPage }))
          .then((args) => {
            const subpages = args.page.subpagePaths.map((filePath) =>
              this.parsePage(filePath, args.page)
            );
            return Promise.all(subpages)
              .then((children) => ({
                children,
                extendedPage: Object.assign(args.page, {
                  children: args.page.children.concat(children),
                }),
              }));
          })
          .then(({ extendedPage }) => {
            this.logger.success('Parsed page', {
              page: _.pick(extendedPage, [
                'name',
                'route',
              ]),
            });
            // TODO: return immutable page settings
            return extendedPage;
          });
      });
  });
}

function updatePageConfigs(pages, webpackConfig) {
  const updates = pages.map((page) => this.updatePageConfig(page, webpackConfig));
  return Promise.all(updates).then((updatedPages) => ({
    pages: updatedPages,
    webpackConfig,
  }));
}

function updatePageConfig(page, webpackConfig) {
  return Promise.resolve()
    .then(() => this.applyPageOnWebpack(page))
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
      return Promise.all(configs)
        .then(() => page);
    });
}

const pagesReducer = (prev, page) => {
  prev.push(page);
  if (page.children.length > 0) {
    page.children.reduce(pagesReducer, prev);
  }
  return prev;
};

// TODO: Use async walkPages() instead and keep tree
function reducePages(pages) {
  return pages.reduce(pagesReducer, []);
}

/**
 * Creates a webpack entry on the webpack config
 * TODO: take webpack config as immutable
 */
function applyPageOnWebpack(page) {
  this.logger.start('Creating webpack entry', {
    page: _.pick(page, [
      'name',
      'route',
      'send',
    ]),
  });

  if (page.createEntry === false || (!page.htmlFileFullPath && !page.send
    && !page.index && !page.template && !page.customSend && !page.customData)) {
    return null;
  }

  // Push client entry point to beginning
  const webpackEntry = [
    path.resolve(__dirname, './client/index.js'),
  ];

  if (this.isDEV) {
    // TODO: Make it work without reload, move to dev setup as hook
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

      const chunks = [page.entryName];
      if (page.commons) {
        chunks.unshift('commons');
      }

      if (page.template) {
        page.htmlPlugin = new HtmlWebpackPlugin({ // eslint-disable-line
          template: page.template,
          filename: `../${page.htmlFile}`,
          chunks,
          inject: page.inject,
          cache: false,
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
  applyPageOnWebpack,
  reducePages,
};
