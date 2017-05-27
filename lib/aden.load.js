const {
  KEY_RPATH,
  KEY_PAGE_PATH,
  KEY_FILE_ARRAY,
  KEY_FILE,
  KEY_APATH,
  ENTRY_STATIC,
  ENTRY_DYNAMIC,
  KEY_DIST_PATH,
} = require('./aden.constants');

const fs = require('fs');
const path = require('path');
const conflate = require('conflate');
const cannot = require('brokens');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

function setup(rootPages) {
  this.log.debug(`Loading up app ${rootPages[0].rootPath}`);
  return this.postLoadWalk(rootPages)
    .then((pages) => ({ pages }));
}

// Iterate loaded file tree,
// page attributes/methods that are generated from props should go here
function postLoadWalk(pages) {
  return this.walkPages(pages, this.rootConfig,
    (walkPage, parentPage) => Promise.resolve()
      .then(() => Object.assign(walkPage, {
        pagePath: path.resolve(
          this.rootConfig.rootPath,
          walkPage.keys.find((key) => (key.name === 'path')).value
        ),
      }))
      .then(() => this.loadAdenFile(walkPage.pagePath))
      .then((fileConfig) => this.applyFileConfig(fileConfig, walkPage, parentPage))
      .then(() => this.applyHook('pre:load', { page: walkPage }))
      .then(() => this.resolvePaths(pages[0].rootPath, walkPage))
      .then((page) => this.applyHook('load', { page, parentPage }))
      .then(({ page }) => {
        this.log.debug('Post load walk page', {
          rootResolved: pages[0].rootPath,
          page: _.pick(page, ['name', 'key']),
          parentPage: _.pick(parentPage, ['name', 'path', 'resolved']),
        });

        // Note: Everything that can be stored in the build page.json (htmlFile)
        // should go to loadPages() and for prod comes from loadBuild() then.
        return Object.assign(page, {
          // TODO: bring logger on page path namespace level
          log: page.log || parentPage.log,
          greedy: Array.isArray(page.route)
            ? page.route.filter((route) => route.match(/\*/)).length > 0
            : page.route && !!page.route.match(/\*/),
        });
      })
      .then((page) => this.applyHook('post:load', { page }))
      .then(({ page }) => page)
  );
}


// Parse Pages from file tree
function loadPages(rootPage) {
  this.log.info('Setting up page parser');

  const rootParent = conflate({}, rootPage, { root: true });
  return Promise.all([this.parsePage(rootPage.rootPath, rootParent)]);
}

/**
 * Load pages from dist build (pages.stats.json)
 */
function loadBuild(rootPage) {
  return Promise.resolve().then(() => {
    this.log.start('Loading build files', {
      'rootPage.key': _.pick(rootPage.key, ['path']),
    });

    try {
      const webpackStats = this.nativeRequire(path.resolve(
        rootPage.dist, this.settings.webpackStatsDist
      ));
      this.webpackStats = webpackStats;
      const build = this.nativeRequire(path.resolve(rootPage.dist, this.settings.pageStatsDist));

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
      this.pages = build.pages.map((page) => Object.assign(page, {
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
      }));

      const root = _.merge(rootPage, this.pagesById[build.info.rootPage]);

      this.log.success('Done loading build files');

      return Promise.all([this.resolvePaths(rootPage.rootPath, root)]);
    } catch (ex) {
      throw cannot('load', 'the aden configuration from dist build')
        .because(ex)
        .addInfo('Did you build the app?');
    }
  });
}

// Async iterate over nested pages
function walkPages(pages, parentPage = {}, cb) {
  return Promise.all(pages.map((page) =>
    Promise.resolve({ page, parentPage })
    .then((hooked) => cb(hooked.page, hooked.parentPage))
    .then((result) => this.walkPages(result.children || [], result, cb)
       .then((children) => Object.assign(result, { children }))
    )
  ));
}

// All paths are relative to the app root we are currently running,
// this resolves all paths for a page.
function resolvePaths(rootPath, page) {
  return Promise.resolve().then(() => {
    const keyObj = page.keys
      .reduce((obj, key) => {
        if (key.value || key.value === '') {
          if (key.type === KEY_RPATH
            || key.type === KEY_FILE) {
            const resolved = path.resolve(rootPath, key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === KEY_DIST_PATH) {
            const resolved = path.resolve(this.rootConfig.dist, key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === KEY_PAGE_PATH) {
            const resolved = path.resolve(rootPath, page.relativePath || '', key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === KEY_FILE_ARRAY) {
            key.value.forEach((fileInfo, index) => {
              let distFileName;
              let dist;
              if (key.entry !== ENTRY_STATIC) {
                distFileName =
                  `.key.${page.entryName}.${key.name.toLowerCase()}.${index}${key.distExt || ''}`;
                dist = path.resolve(this.rootConfig.dist, distFileName);
              } else if (Array.isArray(key.value)) {
                const originalName = path.parse(fileInfo.rpath).name;
                distFileName = `${originalName}${key.distExt || ''}`;
                dist = path.resolve(
                  this.rootConfig.dist,
                  page.keys.find((k) => (k.name === 'distSubPath')).value || 'public',
                  page.relativePath, distFileName
                );
              }
              Object.assign(fileInfo, {
                dist,
                distFileName,
              });

              Object.assign(fileInfo, {
                resolved: path.resolve(rootPath, fileInfo.rpath),
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
              `.key.${page.entryName}.${key.name.toLowerCase()}${key.distExt || ''}`;
            dist = path.resolve(this.rootConfig.dist, distFileName);
          } else if (typeof key.value === 'string') {
            const originalName = path.parse(key.value).name;
            distFileName = `${originalName}${key.distExt || ''}`;
            dist = path.resolve(
              this.rootConfig.dist,
              page.keys.find((k) => (k.name === 'distSubPath')).value || 'public',
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
              value: key.resolve(this.ui),
            });
          }
        }

        Object.assign(key, {
          load(transform) {
            // TODO: invalidate cache when changed
            if (this.cache) return Promise.resolve(this.cache);
            return Promise.resolve()
              .then(() => new Promise((resolve, reject) => {
                fs.readFile(this.dist, (err, content) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  resolve(content);
                });
              }))
              .then((content) => (transform ? transform(content) : content))
              .then((content) => {
                this.cache = content;
                return content;
              });
          },
        });

        return Object.assign(obj, {
          [key.name]: key,
        });
      }, {});

    return _.extend(page, {
      key: keyObj,
    });
  });
}

module.exports = {
  setup,
  loadBuild,
  loadPages,
  walkPages,
  postLoadWalk,
  resolvePaths,
};
