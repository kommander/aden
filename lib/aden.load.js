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
    (page, parentPage) => this.loadAdenFile(page.resolved.path)
      .then((fileConfig) => this.applyFileConfig(fileConfig, page, parentPage))
      .then(() => this.resolvePaths(pages[0].rootPath, page))
      .then(() => this.applyHook('load', { page, parentPage }))
      .then(() => {
        this.logger.debug('Post load walk page', {
          rootResolved: pages[0].resolved,
          page: _.pick(page, ['name', 'path', 'resolved']),
          parentPage: _.pick(parentPage, ['name', 'path', 'resolved']),
        });

        // Note: Everything that can be stored in the build page.json (htmlFile)
        // should go to loadPages() and for prod comes from loadBuild() then.
        return Object.assign(page, {
          // TODO: bring logger on page path namespace level
          logger: page.logger || parentPage.logger,
          greedy: !!page.route.match(/\*/),
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

  return Promise.all([this.parsePage(rootPage.resolved.path, rootParent)]);
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
      const webpackStats = require(path.resolve(
        rootPage.resolved.dist, this.config.webpackStatsDist
      ));
      this.webpackStats = webpackStats;
      const build = require(path.resolve(rootPage.resolved.dist, this.config.pageStatsDist));

      // Inflate
      this.pagesById = build.pages.reduce((pagesById, page) => Object.assign(pagesById, {
        [page.id]: page,
      }), {});

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
          ? '' // set empty to no mount and only load the focus route
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
// TODO: remove hooks here
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
    const resolved = Object.keys(page)
      .filter((key) => [
        'path',
        'dist',
        // Note: Do not resolve defaults relative, as it may differ in prod
        // 'defaults',
        'shared',
      ].concat(this.keys.filter((regKey) =>
        regKey.type === 'rpath'
      ).map((regKey) => regKey.name)).includes(key))
      .filter((key) => typeof page[key] === 'string')
      .reduce((prev, key) => _.extend(prev, {
        [key]: ((skey) => {
          switch (skey) {
            case 'shared':
              // Resolve shared paths on page level
              // TODO: Check if paths actually exists (when parsing) and only add then
              return path.resolve(rootPath, page.path, page[skey]);
            default:
              return path.resolve(rootPath, page[skey]);
          }
        })(key),
      }), {});

    _.merge(page, {
      resolved,
    });

    this.logger.debug('resolved paths', {
      rootPath,
      page: _.pick(page, [
        'name',
        'path',
        'resolved',
      ]),
    });

    return page;
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
