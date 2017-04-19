const AdenConstants = require('./aden.constants');

const path = require('path');
const conflate = require('conflate');
const cannot = require('cannot');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

function setup(rootPages) {
  this.logger.debug(`Loading up app ${rootPages[0].rootPath}`);

  return this.applyHook('pre:load', { pages: rootPages })
    .then(({ pages }) => this.loadDefaultPages(pages))
    .then((pages) => this.postLoadWalk(pages))
    .then((pages) => this.applyHook('post:load', { pages }));
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
      .then(() => this.resolvePaths(pages[0].rootPath, walkPage))
      .then((page) => this.applyHook('load', { page, parentPage }))
      .then(({ page }) => {
        this.logger.debug('Post load walk page', {
          rootResolved: pages[0].rootPath,
          page: _.pick(page, ['name', 'key']),
          parentPage: _.pick(parentPage, ['name', 'path', 'resolved']),
        });

        // Note: Everything that can be stored in the build page.json (htmlFile)
        // should go to loadPages() and for prod comes from loadBuild() then.
        return Object.assign(page, {
          // TODO: bring logger on page path namespace level
          logger: page.logger || parentPage.logger,
          greedy: Array.isArray(page.route)
            ? page.route.filter((route) => route.match(/\*/)) > 0
            : !!page.route.match(/\*/),
        });
      })
  );
}

// TODO: Allow to overide some paths like defaults with env variables
function loadDefaultPages(pages) {
  this.logger.debug('Loading default pages', pages[0], _.pick(pages[0], [
    'name', 'path', 'defaults', 'error', 'notFound', 'resolved',
  ]));

  const errPagePath = path.resolve(pages[0].defaults, pages[0].error);
  const errPage = this.parsePage(errPagePath, pages[0]);

  const notFoundPagePath = path.resolve(pages[0].defaults, pages[0].notFound);
  const notFoundPage = this.parsePage(notFoundPagePath, pages[0]);

  return Promise.all([pages[0], errPage, notFoundPage]);
}

// Parse Pages from file tree
function loadPages(rootPage) {
  this.logger.info('Setting up page parser');

  const rootParent = conflate({}, rootPage, { root: true });
  return Promise.all([this.parsePage(rootPage.rootPath, rootParent)]);
}

/**
 * Load pages from dist build (pages.stats.json)
 */
function loadBuild(rootPage) {
  return Promise.resolve().then(() => {
    this.logger.start('Loading build files', {
      rootPage: _.pick(rootPage, ['path', 'resolved']),
    });

    try {
      const webpackStats = this.nativeRequire(path.resolve(
        rootPage.dist, this.config.webpackStatsDist
      ));
      this.webpackStats = webpackStats;
      const build = this.nativeRequire(path.resolve(rootPage.dist, this.config.pageStatsDist));

      // Inflate
      this.pagesById = build.pages.reduce((pagesById, page) => Object.assign(pagesById, {
        [page.id]: page,
      }), {});

      // TODO: check if loaded page has all the keys registered
      //       Example: When building without the favicon extension de-activated,
      //       then running the build _with_ the extension, it may expect a key
      //       to be present that was not saved to the page at build time.
      this.pages = build.pages.map((page) => Object.assign(page, {
        children: page.children
          .map((id) => this.pagesById[id])
          .filter((child) => (rootPage.focusPath
            ? pathIsInside(
              path.resolve('/', rootPage.focusPath),
              path.resolve('/', child.path)
            )
            : true
          )),
        route: rootPage.focusPath && (!pathIsInside(
            path.resolve('/', rootPage.focusPath),
            path.resolve('/', page.path)
          ) || page.path !== rootPage.focusPath)
          ? '' // set empty to not mount and only load the focus route
          : page.route,
      }));

      const root = _.merge(rootPage, this.pagesById[build.info.rootPage]);

      this.logger.success('Done loading build files');

      return [root];
    } catch (ex) {
      throw cannot('load', 'the aden configuration from dist build')
        .because(ex)
        .addInfo('Did you build the app?');
    }
  });
}

// Async iterate over nested pages
function walkPages(pages, parentPage, cb) {
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
          if (key.type === AdenConstants.KEY_TYPE_RPATH
            || key.type === AdenConstants.KEY_TYPE_FILE) {
            const resolved = path.resolve(rootPath, key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === AdenConstants.KEY_TYPE_PAGE_PATH) {
            const resolved = path.resolve(rootPath, page.relativePath || '', key.value);
            Object.assign(key, {
              resolved,
              dir: path.parse(resolved).dir,
            });
          } else if (key.type === AdenConstants.KEY_TYPE_FILE_ARRAY) {
            key.value.forEach((fileInfo) => Object.assign(fileInfo, {
              resolved: path.resolve(rootPath, fileInfo.rpath),
            }));
            Object.assign(key, {
              dir: path.parse(path.resolve(rootPath, page.relativePath || '')).dir,
            });
          }

          if (key.build) {
            const distFileName = `.key.${page.entryName}.${key.name.toLowerCase()}`;
            Object.assign(key, {
              dist: path.resolve(this.rootConfig.dist, distFileName),
              distFileName,
            });
          }
        }

        return Object.assign(obj, {
          [key.name]: key,
        });
      }, {});

    this.logger.debug('resolved paths', {
      rootPath,
      page: _.pick(page, [
        'name',
        'path',
        'resolved',
      ]),
    });

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
  loadDefaultPages,
};
