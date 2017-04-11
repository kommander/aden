const path = require('path');
const conflate = require('conflate');
const cannot = require('cannot');
const _ = require('lodash');

function load(rootConfig) {
  this.logger.debug(`Loading up app ${rootConfig.rootPath}`);

  return this.loadAdenFile(rootConfig.rootPath, true)
    .then((fileConfig) => _.extend(rootConfig, _.pick(fileConfig, [
      'defaults',
      'error',
      'notFound',
    ])))
    .then((rootPage) => this.resolvePaths(rootPage.rootPath, rootPage))
    .then((rootPage) => this.executeHook('pre:load', { rootPage }))
    .then(({ rootPage }) => {
      if (this.isDEV || this.rootConfig.buildOnly) {
        return this.loadPages(rootPage);
      }
      return this.loadBuild(rootPage);
    })
    .then((pages) => this.loadDefaultPages(pages))
    .then((pages) => this.walkPages(pages, pages[0], null, null, (nextPage, parentPage) =>
      this.resolvePaths(pages[0].rootPath, nextPage)
        .then((page) => this.loadAdenFile(page.resolved.path)
          .then((fileConfig) => this.applyFileConfig(fileConfig, page, parentPage))
        )
    ))
    .then((pages) => this.executeDotFiles(pages))
    .then((pages) => this.postLoadWalk(pages))
    .then((pages) => this.executeHook('post:load', { pages }));
}

// Iterate loaded file tree,
// page attributes/methods that are generated from props should go here
function postLoadWalk(pages) {
  return this.walkPages(pages, this.rootConfig, 'pre:walk', 'post:walk', (page, parentPage) => {
    let send = page.send || (page.template ? this.defaultSend : null);

    // Send string data
    if (typeof send === 'string') {
      const str = send;
      send = (req, res) => {
        res.send(str);
      };
    }

    this.logger.debug('Post load walk page', {
      rootResolved: pages[0].resolved,
      page: _.pick(page, ['name', 'path', 'resolved']),
      parentPage: _.pick(parentPage, ['name', 'path', 'resolved']),
    });

    // Note: Everything that can be stored in the build page.json (htmlFile)
    // should go to loadPages() and for prod comes from loadBuild() then.
    return Object.assign(page, {
      templateEngine: page.templateEngine
        || parentPage.templateEngine
        || this.getDefaultTemplateEngine(),
      loadData: this.emptyData,
      send,
      htmlFile: page.template ? `${page.entryName}.html` : null,
      htmlFileFullPath: page.template ? path.resolve(
        pages[0].resolved.dist,
        `${page.entryName}.html`
      ) : null,
      // TODO: bring logger on page path namespace level
      logger: page.logger || parentPage.logger,
    });
  });
}

// TODO: Allow to overide some paths like defaults with env variables
function loadDefaultPages(pages) {
  this.logger.debug('Loading default pages', pages[0], _.pick(pages[0], [
    'name', 'path', 'defaults', 'error', 'notFound', 'resolved',
  ]));

  // TODO: Check if default pages exist in rootConfig.path, if not load from defaults path
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

// Iterate over pages and found dot files, execute hooks
function executeDotFiles(pages) {
  const promises = this.flattenPages(pages)
    .filter((page) => page.dotFiles.length > 0)
    .map((page) => page.dotFiles.map((fileInfo) => Promise.resolve().then(() => {
      this.logger.debug('Executing dot file', {
        fileInfo,
        page: _.pick(page, [
          'name', 'path', 'resolved',
        ]),
      });

      if (fileInfo.isDir) {
        if (fileInfo.file === page.sendDir) {
          // TODO: load files async
          // TODO: !!! initialize send, data, plugins after all pages are parsed,
          //       to allow a sender to have access to all routes and webpack info on setup.
          const customSender = this.loadCustom(
            path.resolve(fileInfo.fullFilePath, 'index.js')
          );
          Object.assign(page, {
            send: customSender || page.send,
          });
        } else if (fileInfo.file === page.dataDir) {
          const customData = this.loadCustom(
            path.resolve(fileInfo.fullFilePath, 'index.js')
          );
          Object.assign(page, {
            loadData: customData || page.loadData,
          });
        }
      } else {
        this.logger.debug('Dotfile fileInfo.base === page.sendFile',
          fileInfo.file === page.sendFile, fileInfo.file, page.sendFile);

        if (fileInfo.file === page.sendFile) {
          const customSend = this.loadCustom(fileInfo.fullFilePath);
          Object.assign(page, {
            send: customSend || page.send,
          });
        } else if (fileInfo.file === page.dataFile) {
          const customData = this.loadCustom(fileInfo.fullFilePath);
          Object.assign(page, {
            loadData: customData || page.loadData,
          });
        } else if (fileInfo.file === page.templateEngineFile) {
          const customTemplateEngine = this.loadCustom(fileInfo.fullFilePath);
          Object.assign(page, {
            templateEngine: customTemplateEngine || page.templateEngine,
          });
        }
      }
    }))
  );
  return Promise.all(promises)
    .then(() => pages);
}

// Load pages from dist build (pages.stats.json)
function loadBuild(rootPage) {
  return Promise.resolve().then(() => {
    this.logger.start('Loading build files', {
      rootPage: _.pick(rootPage, ['path', 'resolved']),
    });

    try {
      const webpackStats = require(path.resolve(rootPage.resolved.dist, rootPage.webpackStatsDist));
      this.webpackStats = webpackStats;
      const build = require(path.resolve(rootPage.resolved.dist, rootPage.pageStatsDist));

      // Inflate
      this.pagesById = build.pages.reduce((pagesById, page) => Object.assign(pagesById, {
        [page.id]: page,
      }), {});

      this.pages = build.pages.map((page) => Object.assign(page, {
        children: page.children.map((id) => this.pagesById[id]),
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
function walkPages(pages, parentPage, preHook, postHook, cb) {
  return Promise.all(pages.map((page) =>
    (preHook
      ? this.executeHook(preHook, { page, parentPage })
      : Promise.resolve({ page, parentPage })
    )
    .then((hooked) => cb(hooked.page, hooked.parentPage))
    .then((result) => this.walkPages(result.children || [], result, preHook, postHook, cb)
       .then((children) => Object.assign(result, { children }))
       .then((walkedPage) =>
         (postHook
           ? this.executeHook(postHook, { page: walkedPage })
             .then((hooked) => hooked.page)
           : Promise.resolve(walkedPage)
         )
       )
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
        'defaults',
        'index',
        'template',
        'style',
        'favicon',
        'shared',
      ].includes(key))
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
  load,
  loadBuild,
  loadPages,
  executeDotFiles,
  walkPages,
  postLoadWalk,
  resolvePaths,
  loadDefaultPages,
};
