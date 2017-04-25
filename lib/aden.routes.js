'use strict';

const express = require('express');
const path = require('path');
const cannot = require('cannot');
const _ = require('lodash');

// TODO: Allow { routes: { get: ..., post: ... } } in .server

// TODO: take app as argument
function setupApp(rootPage) {
  // TODO: Use a router per entry point
  this.router = express.Router(); // eslint-disable-line

  // header
  // TODO: Move to extension (loaded by default)
  if (typeof this.rootConfig.poweredBy === 'string') {
    this.app.disable('x-powered-by');
    this.app.use((req, res, next) => {
      res.set({
        'X-Powered-By': this.rootConfig.poweredBy,
      });
      next();
    });
  }

  // Statics are needed to be served at least for development
  if (rootPage.serveStatics === true) {
    this.logger.start(`Serving statics at ${rootPage.basePath}`);
    const from = path.resolve(this.rootConfig.dist, 'public');
    this.logger.debug(`Serving statics from ${from}`);

    // TODO: + publicPath
    this.app.use(rootPage.basePath, express.static(from));
  }

  return this.applyHook('setup', { app: this.app, rootPage })
    .then(() => this.setupRoutes(this.router, [rootPage].concat(this.defaultPages)))
    .then(() => {
      // Note: The router needs to be wrapped here to allow switching out in dev
      this.logger.debug('Setting up base router');
      this.app.use(rootPage.basePath, (req, res, next) => this.router(req, res, next));

      // Last, add a not found handler if given
      if (this.notFoundPage && this.notFoundPage.get) {
        this.logger.debug('Setting up Not Found Route', {
          page: _.pick(this.notFoundPage, [
            'name',
            'path',
          ]),
        });

        this.app.use((req, res, next) => {
          this.notFoundRoute(req, res, next);
        });
      } else {
        this.logger.warn('No 404 page.');
        this.app.use((req, res) => {
          res.status(404);
          res.end('not found');
        });
      }

      if (this.errorPage && this.errorPage.get) {
        this.logger.debug('Setting up Error Route', {
          page: _.pick(this.notFoundPage, [
            'name',
            'path',
          ]),
        });

        this.app.use(rootPage.basePath, (err, req, res, next) => {
          this.errorRoute(err, req, res, next);
        });
      } else {
        this.logger.warn('No Error page.');
        this.app.use((err, req, res, next) => {
          this.logger.error('(No Error Page)', err);
          res.status(500);
          res.end('Error');
          return next();
        });
      }
    });
}

function notFoundRoute(req, res, next) {
  if (res.headersSent) {
    this.logger.warn('404 headers already sent.');
    next();
    return;
  }

  res.status(404);

  Promise.resolve().then(() => this.notFoundPage.get(req, res, this.notFoundPage, null, next))
  .catch(errPageErr => {
    // TODO: when user 404 page fails, use aden default 404 page
    this.logger.error('404 Page Broken :/', errPageErr);
    process.exit(1);
  });
}

function errorRoute(err, req, res, next) {
  this.logger.error('Unhandled:', err);

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(err.status || 500);

  Promise.resolve().then(() => this.errorPage.get(req, res, this.errorPage, err, next))
    .catch(errPageErr => {
      // TODO: when user error page fails, use aden default error page
      this.logger.error('Error Page Broken :/', errPageErr);
      process.exit(1);
    });
}

function setupRoutes(router, pages) {
  return Promise.resolve().then(() => {
    // TODO: Check for colliding routes and warn.
    const routes = this.flattenPages(pages)
      .map((page) => {
        this.logger.start(`Creating Route ${page.route || page.name}`, {
          page: _.pick(page, [
            'name', 'route', 'get',
          ]),
        });

        // Have one router per page
        Object.assign(page, {
          router: express.Router(), //eslint-disable-line
        });

        if (page.name === pages[0].error) {
          this.logger.debug('Choosing Error Page', _.pick(page, [
            'name',
            'path',
          ]));
          this.errorPage = Object.assign(page, { route: this.isPROD ? false : page.route });
        }

        if (page.name === pages[0].notFound) {
          this.logger.debug('Choosing Not Found Page', _.pick(page, [
            'name',
            'path',
          ]));
          this.notFoundPage = Object.assign(page, { route: this.isPROD ? false : page.route });
        }

        return page;
      })
      .sort((a, b) => {
        // Put greedy routes to the back to allow explicit routes to be matched
        if (a.greedy && !b.greedy) {
          return 1;
        }
        if (!a.greedy && b.greedy) {
          return -1;
        }
        return 0;
      })
      .map((page) => this.applyHook('setup:route', { router, page }));

    if (routes.length === 0) {
      throw cannot('setup', 'routes')
        .because('there aren\'t any')
        .addInfo('Maybe there is no entry point, like an index.html.');
    }

    // Gather all routes async, then apply them in order to the router
    return Promise.all(routes)
      .then((results) => {
        const pagesAgain = results.map(({ page }) => {
          // controllers for get/post/put/delete/all requests
          ['get', 'post', 'put', 'delete', 'all'].forEach((method) => {
            let handlers = page[method] || [];

            // Send string data
            if (typeof handlers === 'string') {
              const str = handlers;
              handlers = [(req, res) => res.send(str)];
            } else if (typeof handlers === 'function') {
              handlers = [handlers];
            }

            if (handlers.length === 0) {
              this.logger.debug(`No handler for ${method.toUpperCase()} ${page.route}`);
              return;
            }

            const send = handlers.pop();

            const sendClosure = (req, res, next) => Promise.resolve()
              .then(() => send(req, res, page, { /* data */}, next))
              .catch((err) => next(err));

            if (!send) {
              this.logger.error('No send method.');
            }

            Object.assign(page, {
              [method]: send,
            });

            const finalRoutes = ['']
              .concat(handlers)
              .concat(sendClosure);

            page.router[method].apply(
              page.router,
              finalRoutes
            );

            this.logger.success(
              `Set up ${method.toUpperCase()} controller for ${page.route}`
            );
          });

          if (page.route && page.route.length > 0) {
            const pageRoutes = [].concat([page.route]);
            pageRoutes.forEach((route) => router.use(route, page.router));
          }

          return page;
        });

        return { router, pages: pagesAgain };
      });
  });
}

/**
 * Loads a function wrapped module and hands over aden and the page in scope
 * TODO: Sandbox custom components (put in separate context/isolate, or xipc)
 */
function loadCustom(filePath, pageScope) {
  this.logger.info(`load custom ${filePath}`);
  try {
    if (this.isDEV) {
      require.cache[require.resolve(filePath)] = null;
    }
    // TODO: register extension with init return value (must be present)
    const wrapper = this.nativeRequire(filePath);

    if (typeof wrapper !== 'function') {
      throw cannot('load', 'custom handler')
        .because('the wrapper is not a function')
        .addInfo(typeof wrapper)
        .addData(wrapper);
    }

    const fn = wrapper(this, pageScope);

    return fn;
  } catch (ex) {
    this.logger.error(`Error loading custom page handler ${filePath}`, ex);
    return null;
  }
}

module.exports = {
  loadCustom,
  setupApp,
  notFoundRoute,
  errorRoute,
  setupRoutes,
};
