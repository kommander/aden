'use strict';

//
// Aden Middleware Plugin
//
const path = require('path');
const fs = require('fs');
const conflate = require('conflate');

function setupPlugin(aden) {
  aden.hook('pre:walk', (args) => {
    const page = args.page;
    const parentPage = args.parentPage;
    page.middlewaresAvailable = conflate({}, parentPage.middlewaresAvailable || {});
    page.middlewares = parentPage.middlewares ? parentPage.middlewares.slice(0) : [];
    page.middlewareDir = parentPage.middlewareDir || '.middleware';
    return page;
  });

  aden.hook('parse:dot', (args) => {
    const page = args.page;

    if (args.file === page.middlewareDir) {
      const middlewarePath = path.resolve(page.path, page.middlewareDir);
      return new Promise((resolve, reject) => fs.readdir(middlewarePath, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        files.forEach((file) => {
          const fileInfo = path.parse(file);
          const warePath = path.resolve(middlewarePath, file);
          try {
            const setupMiddleware = require(warePath); // eslint-disable-line
            const ware = setupMiddleware(aden);
            if (typeof ware !== 'function') {
              throw new Error('Middleware is not a function');
            }
            page.middlewaresAvailable[fileInfo.name] = ware;
            page.middlewares.push(fileInfo.name);
          } catch (ex) {
            aden.logger.error('Problem loading middlware', { warePath }, ex, args.fullFilePath);
            reject(ex);
          }
        });
        resolve();
      }));
    }
    return null;
  });

  aden.hook('pre:route', (args) => {
    const page = args.page;
    page.middlewares.forEach((name) => {
      const middleware = page.middlewaresAvailable[name];
      args.handlers.push(middleware);
    });
    return args;
  });
}

module.exports = setupPlugin;
