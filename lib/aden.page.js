'use strict';

const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

function parsePage(pagePath, maybeParentPage) {
  return Promise.resolve().then(() => {
    try {
      fs.accessSync(pagePath, fs.F_OK | fs.R_OK);
    } catch (ex) {
      this.logger.error(`FATAL: Page path "${pagePath}" not accessible.`, ex);
      process.exit(1);
    }

    const parentPage = maybeParentPage || {};
    const dirInfo = path.parse(pagePath);
    const name = dirInfo.name;

    // TODO: Warn when path was already parsed
    // TODO: Warn when trying to parse a page outside of the root path
    const relativePath = path.relative(this.rootConfig.rootPath, pagePath);

    // TODO: Use relative path as default route _if inside root path_
    const route = `/${relativePath}` || '/';

    this.logger.start(`Parsing page ${route}`, {
      maybeParentPage: _.pick(maybeParentPage, [
        'id',
        'name',
        'route',
        'path',
        'defaults',
      ]),
    });

    const basePage = {
      id: uuid.v1(),
      name,
      path: relativePath,
      basePath: parentPage.basePath.slice(-1) !== '/' ?
        `${parentPage.basePath}/` : parentPage.basePath,
      route,
      entryName: (parentPage.entryName ?
        parentPage.entryName + parentPage.entryNameDelimiter : '')
          + name.replace(parentPage.entryNameDelimiter, ''),
      createEntry: !!parentPage.createEntry,

      // TODO: move to html extension
      inject: parentPage.inject,

      children: [],

      commons: !!parentPage.commons,
      shared: parentPage.shared,
      entryNameDelimiter: parentPage.entryNameDelimiter,
      ignore: parentPage.ignore,
      noWatch: parentPage.noWatch,

      subpagePaths: [],
      files: [],

      resolved: {
        path: pagePath,
      },

      loaders: [],

      // these could go to something like this.serverSettings, not needed per page
      serveStatics: !!parentPage.serveStatics,
      defaults: parentPage.defaults,
      error: parentPage.error,
      notFound: parentPage.notFound,
      dist: parentPage.dist,
      rootPath: parentPage.rootPath,
      focusPath: parentPage.focusPath,
    };

    // Apply inherited extension keys
    _.extend(basePage, this.keys
        .filter((key) => key.inherit === true)
        .reduce((obj, key) => Object.assign(obj, {
          [key.name]: parentPage[key.name] || key.default,
        }), {})
    );

    return this.applyHook('pre:parse', { page: basePage, parentPage })
      .then(({ page }) => new Promise((resolve, reject) => fs.readdir(pagePath, (err, files) => {
        if (err) {
          reject(err);
        }
        resolve({ page, files });
      })))
      .then(({ page, files }) => {
        this.logger.debug(`Page parse files: ${files}`);

        const parsedPage = files
          .filter((file) => file !== '.aden')
          .map((file) => {
            const fullFilePath = path.resolve(pagePath, file);
            const fileStats = fs.statSync(fullFilePath);
            const fileInfo = path.parse(fullFilePath);

            // Add file type info to fileInfo for serialization
            const isDir = fileStats.isDirectory();

            return {
              fullFilePath,
              isDir,
              rpath: path.relative(page.rootPath, fullFilePath),
              name: fileInfo.name,
              file,
            };
          })
          .reduce((prev, fileInfo) => {
            if (fileInfo.isDir) {
              this.logger.debug('Is Dir', {
                path: fileInfo.fullFilePath, focusPath: prev.focusPath,
              });

              // Ignore as subpages
              const filterMatches = prev.ignore.filter((value) => fileInfo.file.match(value));
              if (fileInfo.file.indexOf('.') === 0 || filterMatches.length !== 0) {
                this.logger.debug(`IGNORED: "${fileInfo.file}" (config.ignore)`);
                return prev;
              }

              // Go recursive, handle focus path
              if (!prev.focusPath) {
                prev.subpagePaths.push(fileInfo.fullFilePath);
              } else if (pathIsInside(
                  path.resolve(prev.rootPath, prev.focusPath),
                  fileInfo.fullFilePath)
              ) {
                if (prev.resolved.path !== prev.focusPath) {
                  Object.assign(prev, { route: '' });
                }
                prev.subpagePaths.push(fileInfo.fullFilePath);
              }

              this.logger.debug('Ignoring subpage in favour of focus path', {
                path: fileInfo.fullFilePath,
              });

              return prev;
            }

            // TODO: Warn when finding .dist folders (which should only be on root level)

            // TODO: trigger file type handler hook with
            const fileHandler = this.fileHandlers.filter((handler) =>
              !!fileInfo.file.match(handler.regex)
            )[0]; // TODO: handle more that one

            if (fileHandler) {
              // TODO: log extensions that are handling the file
              this.logger.info(`Handling file ${fileInfo.rpath}`);
              fileHandler.fn.call(this, { page: prev, fileInfo });
            }

            return prev;
          }, page); // end files.reduce

        return this.applyHook('post:parse', { page: parsedPage, parentPage, files })
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
            this.logger.success(`Parsed page ${page.path}`, {
              page: _.pick(extendedPage, ['name', 'route']),
            });
            // TODO: return immutable page settings
            return extendedPage;
          });
      });
  });
}

function applyFileConfig(fileConfig, page, parentPage) {
  // TODO: Separate settings from actual page features/attributes
  //       (overridable and non-overridable)
  _.merge(
    page,
    {
      dist: parentPage.dist,
    }, _.omit(fileConfig, [
      // TODO: ignore registered keys accordingly here
      'id', 'shared', 'entryName', 'dirInfo', 'resolved',
      'path', 'template', 'index', 'style', 'entryNameDelimiter',
      'children', 'loadData', 'htmlFile', 'htmlFileFullPath',
      'entry', 'middlewaresAvailable', 'logger',
    ])
  );

  if (fileConfig.route) {
    Object.assign(page, {
      route: Array.isArray(fileConfig.route)
        ? fileConfig.route.map((route) => `/${page.path}${route}`)
        : `/${page.path}${fileConfig.route}`,
    });
  }

  return page;
}

const pagesReducer = (prev, page) => {
  prev.push(page);
  if (page.children.length > 0) {
    page.children.reduce(pagesReducer, prev);
  }
  return prev;
};

// TODO: Use async walkPages() instead and keep tree
function flattenPages(pages) {
  return pages.reduce(pagesReducer, []);
}

module.exports = {
  parsePage,
  flattenPages,
  applyFileConfig,
};
