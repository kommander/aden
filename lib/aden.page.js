'use strict';

const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const _ = require('lodash');
const pathIsInside = require('path-is-inside');

const { KEY_TYPE_OBJECT } = require('./aden.constants.js');

function parsePage(pagePath, maybeParentPage) {
  return Promise.resolve().then(() => {
    try {
      fs.accessSync(pagePath, fs.F_OK | fs.R_OK);
    } catch (ex) {
      this.log.error(`FATAL: Page path "${pagePath}" not accessible.`, ex);
      process.exit(1);
    }

    const parentPage = maybeParentPage || {};
    const dirInfo = path.parse(pagePath);
    const name = dirInfo.name;

    // TODO: Warn when path was already parsed
    // TODO: Warn when trying to parse a page outside of the root path
    //       - except default pages, which might be outside
    const relativePath = path.relative(this.rootConfig.rootPath, pagePath);

    // TODO: Use relative path as default route _if inside root path_
    const route = `/${relativePath}` || '/';

    this.log.start(`Parsing page ${route}`, {
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
      relativePath,
      pagePath,
      basePath: parentPage.basePath.slice(-1) !== '/' ?
        `${parentPage.basePath}/` : parentPage.basePath,
      route,
      entryName: (parentPage.entryName ?
        parentPage.entryName + parentPage.entryNameDelimiter : '')
          + name.replace(parentPage.entryNameDelimiter, ''),
      createEntry: !!parentPage.createEntry,

      // TODO: move to html attitude(?) Actually a core setting that attitudes can react to
      inject: parentPage.inject,

      children: [],

      commons: !!parentPage.commons,
      entryNameDelimiter: parentPage.entryNameDelimiter,
      ignore: parentPage.ignore,
      noWatch: parentPage.noWatch,

      subpagePaths: [],

      rules: [],

      error: parentPage.error,
      notFound: parentPage.notFound,

      // these could go to something like this.serverSettings, not needed per page
      serveStatics: !!parentPage.serveStatics,
      defaults: parentPage.defaults,
      rootPath: parentPage.rootPath,
      focusPath: parentPage.focusPath,
    };

    return this.applyKeys(basePage, parentPage.keys)
      .then((appliedKeyPage) => {
        Object.assign(appliedKeyPage.key.path, {
          value: relativePath,
        });
        return appliedKeyPage;
      })
      .then((page) => this.loadAdenFile(pagePath)
        .then((fileConfig) => this.applyFileConfig(fileConfig, page))
        .then(() => page)
      )
      .then((page) => this.applyHook('pre:parse', { page, parentPage }))
      .then(({ page }) => new Promise((resolve, reject) => fs.readdir(pagePath, (err, files) => {
        if (err) {
          reject(err);
        }
        resolve({ page, files });
      })))
      .then(({ page, files }) => {
        this.log.debug(`Page parse files: ${files}`);

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
              dir: fileInfo.dir,
            };
          })
          .reduce((prev, fileInfo) => {
            if (fileInfo.isDir) {
              this.log.debug('Is Dir', {
                path: fileInfo.fullFilePath, focusPath: prev.focusPath,
              });

              // Ignore as subpages
              const filterMatches = prev.ignore
                .concat(prev.key.ignore.value)
                .filter((value) => fileInfo.file.match(value));
              if (fileInfo.file.indexOf('.') === 0 || filterMatches.length !== 0) {
                this.log.debug(`IGNORED: "${fileInfo.file}" (config.ignore)`);
                return prev;
              }

              // TODO: max recursive depth: 4 default

              // Go recursive, handle focus path
              if (!prev.focusPath) {
                prev.subpagePaths.push(fileInfo.fullFilePath);
              } else if (
                pathIsInside(
                  fileInfo.fullFilePath,
                  path.resolve(prev.rootPath, prev.focusPath)
                )
              ) {
                if (prev.key.path.resolved !== prev.focusPath) {
                  Object.assign(prev, { route: false });
                }
                prev.subpagePaths.push(fileInfo.fullFilePath);
              }

              this.log.debug('Ignoring subpage in favour of focus path', {
                path: fileInfo.fullFilePath,
              });

              return prev;
            }

            // TODO: Warn when finding .dist folders (which should only be on root level)

            // Remove fullFilePath as paths should be resolved relative to the root dir
            Object.assign(fileInfo, {
              fullFilePath: null,
            });

            // trigger file type handlers
            this.fileHandlers.filter((handler) =>
              handler.matcher({ page, fileInfo })
            ).forEach((handler) => {
              // TODO: log attitudes that are handling the file
              this.log.info(`Handling file ${fileInfo.rpath}`);

              handler.fn.call(this, {
                page: prev,
                fileInfo,
                key: page.key[handler.keyName],
              });
            });

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
            this.log.success(`Parsed page ${page.key.path.value}`, {
              page: _.pick(extendedPage, ['name', 'route']),
            });
            // TODO: return immutable page settings
            return extendedPage;
          });
      });
  });
}

/**
 * The fileConfig comes from a .server file and should apply the config,
 * to registered config keys.
 */
function applyFileConfig(fileConfig, page) {
  return Promise.resolve().then(() => {
    page.keys
      .filter((key) => key.config)
      .forEach((key) => Object.assign(
        key,
        {
          value: key.type === KEY_TYPE_OBJECT && fileConfig[key.name]
            ? _.merge(key.value || {}, fileConfig[key.name])
            : fileConfig[key.name] || key.value,
        }
      ));

    // Special case
    if (fileConfig.route) {
      Object.assign(page, {
        route: Array.isArray(fileConfig.route)
          ? fileConfig.route.map((route) => `/${page.relativePath}${route}`)
          : `/${page.relativePath}${fileConfig.route}`,
      });
    }

    return page;
  });
}

const pagesReducer = (prev, page) => {
  prev.push(page);
  if (page.children.length > 0) {
    page.children.reduce(pagesReducer, prev);
  }
  return prev;
};

function flattenPages(pages) {
  return pages.reduce(pagesReducer, []);
}

module.exports = {
  parsePage,
  flattenPages,
  applyFileConfig,
};
