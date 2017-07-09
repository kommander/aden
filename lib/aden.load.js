'use strict';

const {
  KEY_RPATH,
  KEY_PAGE_PATH,
  KEY_PAGE_PATH_ARRAY,
  KEY_FILE_ARRAY,
  KEY_FILE,
  KEY_APATH,
  ENTRY_STATIC,
} = require('./aden.constants');

const fs = require('fs');
const path = require('path');
const cannot = require('brokens');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

function postParseLoadSetup(rootPages) {
  return this.walkPages(rootPages,
      (walkPage) => this.bootPage(walkPage)
    )
    .then((pages) => ({ pages }));
}

function postBuildLoadSetup(rootPages) {
  return this.walkPages(rootPages,
      (walkPage) => this.bootPage(walkPage, true)
    )
    .then((pages) => ({ pages }));
}

function restoreBuildPage(buildPage) {
  return Promise.resolve(buildPage)
    .then((page) => this.loadDotServerFile(page.path.resolved))
    .then((fileConfig) => Object.assign(buildPage, {
      fileConfig,
      attitudes: this.sortAttitudes(
        buildPage.attitudes.concat(fileConfig.attitudes || [])
      ),
    }))
    .then((page) => this.loadAttitudes(page, page.attitudes))
    .then((attitudes) => Object.assign(buildPage, {
      activeAttitudes: attitudes,
    }))
    .then((dottedPage) => this.applyFileConfig(dottedPage.fileConfig, dottedPage));
}

function bootPage(pageToLoad, isBuild) {
  return this.applyHook('boot', { page: pageToLoad })
    .then(({ page }) => {
      if (isBuild) {
        return this.restoreBuildPage(page);
      }
      return page;
    })
    .then((page) => this.applyHook('pre:load', { page }))
    .then((args) => this.resolvePaths(this.rootPath, args.page))
    .then((page) => this.applyHook('load', { page }))
    .then(({ page }) => Object.assign(page, {
      greedy: Array.isArray(page.route)
        ? page.route.filter((route) => route.match(/\*/)).length > 0
        : page.route && !!page.route.match(/\*/),
    }))
    .then((page) => this.applyHook('post:load', { page }))
    .then(({ page }) => page);
}

// Parse Pages from file tree
function parseGraphs(pages) {
  return Promise.all(pages
    .map((page) => this.parseGraph(page))
  );
}

function parseGraph(page, parentPage) {
  this.log.info(`Parsing graph for ${page.relativePath ? page.relativePath : page.name}`, {
    action: 'parseGraph',
    entryName: page.entryName,
  });

  return this.parsePage(page, parentPage)
    .then((parsedPage) => {
      const subpages = parsedPage.children.map((subpage) =>
        this.parseGraph(subpage, parsedPage)
      );

      return Promise.all(subpages);
    })
    .then(() => page);
}

/**
 * Load pages from dist build (pages.stats.json)
 */
function loadBuild(rootPage) {
  return Promise.resolve().then(() => {
    this.log.start(`Loading build from ${this.settings.dist}`);

    try {
      const webpackStats = this.nativeRequire(path.resolve(
        this.settings.dist, this.settings.webpackStatsDist
      ));
      this.webpackStats = webpackStats;
    } catch (ex) {
      this.log.info('No webpack stats in build.');
    }

    try {
      const build = this.nativeRequire(path.resolve(
        this.settings.dist, this.settings.pageStatsDist
      ));

      // Inflate
      this.pagesById = build.pages.reduce((pagesById, page) => Object.assign(pagesById, {
        [page.id]: page,
      }), {});

      // TODO: check if loaded page has all the keys registered
      //       Example: When building without the favicon attitude,
      //       then running the build _with_ the attitude, it may expect a key
      //       to be present that was not saved to the page at build time.
      //       When keys get renamed, we also need to rebuild, so a warning and
      //       asking for a rebuild should suffice.
      build.pages.map((page) => Object.assign(page, {
        children: page.children
          .map((id) => this.pagesById[id])
          .filter((child) => (rootPage.focusPath
            ? pathIsInside(
              path.resolve('/', child.relativePath),
              path.resolve('/', rootPage.focusPath)
            )
            : true
          )),
        route: (() => {
          if (rootPage.focusPath) {
            return pathIsInside(
                path.resolve('/', page.relativePath),
                path.resolve('/', rootPage.focusPath)
              )
              ? page.route
              : '';
          }
          return page.route;
        })(),
      }))
      .map((page) => {
        page.keys.forEach((key) => {
          Object.defineProperty(page, key.name, {
            get: () => (key),
          });
        });
        this.extendPageWithMethods(page);

        // Resolve page.path to get started...
        this.resolveRPath(page, page.path);

        return page;
      });

      _.extend(rootPage, this.pagesById[build.info.rootPage]);
      this.pages = build.info.registered.map((id) => this.pagesById[id]);

      this.log.success('Done loading build files');

      return this.pages;
    } catch (ex) {
      throw cannot('load', 'the aden configuration from dist build')
        .because(ex.stack)
        .addInfo('Did you build the app?');
    }
  });
}

// Async iterate over nested pages
function walkPages(pages, cb) {
  return Promise.all(pages.map((page) =>
    Promise.resolve({ page })
    .then((hooked) => cb(hooked.page))
  ));
}

function resolveRPath(page, key) {
  const resolved = path.resolve(this.rootPath, key.value);
  return page.assign(key.name, {
    resolved,
    dir: path.parse(resolved).dir,
  });
}

// All paths are relative to the app root we are currently running,
// this resolves all paths for a page.
function resolvePaths(rootPath, page) {
  return Promise.resolve().then(() => {
    page.keys
      .forEach((key) => {
        if (key.value || key.value === '') {
          if (key.type === KEY_RPATH
            || key.type === KEY_FILE) {
            this.resolveRPath(page, key);
          } else if (key.type === KEY_PAGE_PATH) {
            const resolved = path.resolve(rootPath, page.relativePath || '', key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === KEY_PAGE_PATH_ARRAY) {
            if (Array.isArray(key.value) && key.value.length > 0) {
              const resolved = key.value
                .map((pk) => 
                  path.resolve(rootPath, page.relativePath || '', pk)
                );
              Object.assign(key, {
                resolved,
              });
            }
          } else if (key.type === KEY_FILE_ARRAY) {
            key.value.forEach((fileInfo, index) => {
              let distFileName;
              let dist;
              if (key.entry !== ENTRY_STATIC) {
                distFileName =
                  `${page.entryName}.key.${key.name.toLowerCase()}.${index}${key.distExt || ''}`;
                dist = path.resolve(
                  this.settings.dist, 
                  page.distSubPath.value || 'dynamic',
                  distFileName
                );
              } else if (Array.isArray(key.value)) {
                const originalName = path.parse(fileInfo.rpath).name;
                distFileName = `${originalName}${key.distExt || ''}`;
                dist = path.resolve(
                  this.settings.dist,
                  page.distSubPath.value || 'public',
                  page.relativePath, distFileName
                );
              }
              Object.assign(fileInfo, {
                dist,
                distFileName,
                resolved: path.resolve(rootPath, fileInfo.rpath),
                load: this.generateKeyFileLoader(dist),
              });
            });
            Object.assign(key, {
              dir: path.parse(path.resolve(rootPath, page.relativePath || '')).dir,
            });
          }

          let distFileName;
          let dist;
          if (key.entry !== ENTRY_STATIC) {
            distFileName =
              `${page.entryName}.key.${key.name.toLowerCase()}${key.distExt || ''}`;
            dist = path.resolve(
              this.settings.dist,
              page.distSubPath.value || 'dynamic',
              distFileName
            );
          } else if (typeof key.value === 'string') {
            const originalName = path.parse(key.value).name;
            distFileName = `${originalName}${key.distExt || ''}`;
            dist = path.resolve(
              this.settings.dist,
              page.distSubPath.value || 'public',
              page.relativePath, distFileName
            );
          }
          Object.assign(key, {
            dist,
            distFileName,
          });
        } else {
          if (key.type === KEY_APATH && typeof key.resolve === 'function') {
            Object.assign(key, {
              value: key.resolve(this),
            });
          }
        }

        Object.assign(key, {
          load: this.generateKeyFileLoader(key.dist),
        });
      });
    return page;
  });
}

function generateKeyFileLoader(filePath) {
  const adn = this;
  
  return function load(transform) {
    // TODO: invalidate cache when changed
    if (this.cache) return Promise.resolve(this.cache);
    return Promise.resolve()
      .then(() => new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, content) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(content);
        });
      }))
      .then((content) => (transform ? transform(content) : content))
      .then((content) => {
        if (!adn.isDEV) {
          this.cache = content;
        }
        return content;
      });
  }
}

module.exports = {
  postParseLoadSetup,
  postBuildLoadSetup,
  loadBuild,
  parseGraph,
  parseGraphs,
  walkPages,
  resolvePaths,
  bootPage,
  restoreBuildPage,
  resolveRPath,
  generateKeyFileLoader,
};
