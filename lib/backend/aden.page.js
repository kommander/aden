'use strict';

const path = require('path');
const conflate = require('conflate');
const fs = require('fs');
const url = require('url');

// TODO: Freeze config, after parse
// const freeze = require('deep-freeze');

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
      render: parentPage.render || this.getDefaultRender(),
      renderDir: parentPage.renderDir,
      renderFile: parentPage.renderFile,
      commons: !!parentPage.commons,
      serveStatics: !!parentPage.serveStatics,
      shared: parentPage.shared,
      entryNameDelimiter: parentPage.entryNameDelimiter,
      ignore: parentPage.ignore,
      noWatch: parentPage.noWatch,
      greedyRoutes: false, // Do not inherit greedy routes
    };

    return this.loadAdenFile(pagePath)
      .then((fileConfig) => {
        conflate(page, fileConfig, {
          dist: parentPage.dist,
        },
        // TODO: Separate settings from actual page features
        ['sharedPath', 'entryName', 'route', 'dirInfo',
          'path', 'template', 'index', 'style', 'entryNameDelimiter',
          'children', 'loadData', 'render', 'htmlFile', 'htmlFileFullPath',
          'entry', 'middlewaresAvailable', 'loaders']);

        // Resolve paths
        page.sharedPath = path.resolve(page.path, page.shared);
        page.urlPath = url.resolve(page.basePath, page.route);

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
        page.indexExt = path.parse(page.indexFile).ext;
        page.styleExt = path.parse(page.styleFile).ext;
        page.templateExt = path.parse(page.templateFile).ext;

        const pages = {
          subpagePaths: [],
          dotHooks: [],
        };

        const candidates = {
          index: [],
          template: [],
          style: [],
        };

        if (DEV_ENV) {
          this.logger.debug(`Page parse files: ${files}`);
        }

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fullFilePath = path.resolve(pagePath, file);
          const fileStats = fs.statSync(fullFilePath);
          const fileInfo = path.parse(fullFilePath);

          // Handle dot files
          // TODO: Reload dot files on change during dev
          if (fileInfo.name.indexOf('.') === 0 && file !== '.aden') {
            if (fileStats.isDirectory()) {
              if (file === page.renderDir) {
                // TODO: load files async
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
              if (file === page.renderFile) {
                const customRender = this.loadCustom(fullFilePath);
                page.render = customRender || page.render;
              } else if (file === page.dataFile) {
                const customData = this.loadCustom(fullFilePath);
                page.loadData = customData || page.loadData;
              } else if (file === page.templateEngineFile) {
                const customTemplateEngine = this.loadCustom(fullFilePath);
                page.templateEngine = customTemplateEngine || page.templateEngine;
              }
            }

            pages.dotHooks.push(this.executeHook('parse:dot', {
              page, parentPage, fileInfo, file, fileStats, fullFilePath,
            }));

            continue;
          }

          if (fileStats.isDirectory()) {
            // Ignore as subpages
            const filterMatches = page.ignore.filter((value) => file.match(value));
            if (filterMatches.length !== 0) {
              if (DEV_ENV) {
                this.logger.debug(`IGNORED: "${file}" (config.ignore)`);
              }
              continue;
            }

            // Go recursive
            pages.subpagePaths.push(fullFilePath);
          } else if (fileStats.isFile()) {
            // Chech for entry point candidates
            if (fileInfo.ext === page.indexExt) {
              candidates.index.push(fullFilePath);
            } else if (fileInfo.ext === page.templateExt) {
              candidates.template.push(fullFilePath);
            } else if (fileInfo.ext === page.styleExt) {
              candidates.style.push(fullFilePath);
            }

            // Check for explicit entry points
            if (file === page.indexFile) {
              page.index = fullFilePath;
            } else if (file === page.templateFile) {
              page.template = fullFilePath;
            } else if (file === page.styleFile) {
              page.style = fullFilePath;
            }
          }
        }

        // Try to choose from candidates if no explicit entry point was set
        if (!page.index && candidates.index.length === 1) {
          page.index = candidates.index[0];
        }
        if (!page.template && candidates.template.length === 1) {
          page.template = candidates.template[0];
        }
        if (!page.style && candidates.style.length === 1) {
          page.style = candidates.style[0];
        }

        return Promise.all(pages.dotHooks)
          .then(() => {
            const subpages = [];
            pages.subpagePaths.forEach((filePath) => {
              subpages.push(this.parsePage(filePath, page));
            });
            return Promise.all(subpages);
          })
          .then((childPages) => {
            Array.prototype.push.apply(page.children, childPages);
          })
          .then(() => this.executeHook('post:parse', { page, parentPage }))
          .then(() => {
            this.logger.success(`Parsed page ${pagePath}`, { page });
            return page;
          });
      });
  });
}

function updatePageConfigs(pages) {
  const updates = [];
  for (let i = 0; i < pages.length; i++) {
    updates.push(this.updatePageConfig(pages[i]));
  }
  return Promise.all(updates);
}

function updatePageConfig(page) {
  return Promise.resolve()
    .then(() => this.preparePageEntry(page))
    .then(webpackEntry => {
      if (webpackEntry) {
        const entryName = page.entryName;

        this.webpackConfig.entry[entryName] = webpackEntry;
      }

      if (page.htmlPlugin) {
        this.webpackConfig.plugins.push(page.htmlPlugin);
        if (this.compiler) {
          this.compiler.apply(page.htmlPlugin);
        }
      }

      const configs = [];
      for (let i = 0; i < page.children.length; i++) {
        const childPage = page.children[i];
        configs.push(this.updatePageConfig(childPage));
      }
      return Promise.all(configs);
    });
}

function preparePageEntry(page) {
  this.logger.start(`Preparing entry point for ${page.route} (${page.name})`, { page });

  if (page.createEntry === false) {
    return null;
  }

  const webpackEntry = [
    path.resolve(__dirname, '../frontend/index.js'),
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

      // Ignore pages wihtout valid entry point in production
      if (DEV_ENV) {
        page.template = !!page.template ? page.template : // eslint-disable-line
          `${path.resolve(__dirname, '../templates/empty.html')}`;
      }

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
};
