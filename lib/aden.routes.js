'use strict';

const express = require('express');
const path = require('path');
const cannot = require('brokens');
const _ = require('lodash');

// TODO: Allow { routes: { get: ..., post: ... } } in .server

// TODO: take app as argument
function setupApp(rootPage) {
  // TODO: Use a router per entry point
  this.router = express.Router({ // eslint-disable-line
    mergeParams: true,
  });

  // header
  // TODO: Move to attitude
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
    this.log.start(`Serving statics at ${rootPage.basePath}`);
    const from = path.resolve(this.rootConfig.dist, 'public');
    this.log.debug(`Serving statics from ${from}`);

    // TODO: + publicPath
    this.app.use(rootPage.basePath, express.static(from, {
      // redirect: false,
    }));
  }

  return this.applyHook('setup', _.extend({}, this.ui, { pages: [rootPage] }))
    .then(({ pages }) => this.setupRoutes(this.router, pages))
    .then(() => {
      this.log.debug('Setting up base router');
      if (this.isDEV) {
        // Note: The router needs to be wrapped here to allow switching out in dev
        this.app.use(rootPage.basePath, (req, res, next) => {
          this.router(req, res, next);
        });
      } else {
        this.app.use(rootPage.basePath, this.router);
      }

      this.app.use((req, res, next) => this.notFoundRoute(req, res, next));
      this.app.use(rootPage.basePath, (err, req, res, next) =>
        this.errorRoute(err, req, res, next));
    });
}

function notFoundRoute(req, res, next) {
  if (res.headersSent) {
    this.log.warn('404 headers already sent.');
    return;
  }

  res.status(404);

  Promise.resolve().then(() => this.applyHook('route:notFound', {
    req, res, next,
  }))
  .then(() => {
    if (!res.headersSent) {
      res.status(404);
      res.send('Could not find what you were looking for.');
    }
  })
  .catch(err => next(err));
}

function defaultErrorResponse(err, req, res) {
  if (!res.headersSent) {
    res.status(500);
    if (this.isDEV) {
      res.send(`<pre>${err.stack || err.message || err.code || err}</pre>`);
    } else {
      res.send('Internal Server Error');
    }
  }
}

function errorRoute(err, req, res, next) {
  this.log.error('Unhandled:', err);

  if (res.headersSent) {
    next(err);
    return;
  }

  // TODO: check if status already set, use that then
  if (res.statusCode === 200) {
    res.status(err.status || 500);
  }

  Promise.resolve().then(() => this.applyHook('route:error', {
    err, req, res, next: (hookErr) => {
      this.defaultErrorResponse(hookErr, req, res);
    },
  }))
  .then(() => {
    this.defaultErrorResponse(err, req, res);
  })
  .catch((hookErr) => {
    this.defaultErrorResponse(hookErr, req, res);
  });
}

function setupRoutes(router, pages) {
  return Promise.resolve().then(() => {
    // TODO: Check for colliding routes and warn.
    const routes = this.flattenPages(pages)
      .filter((page) => page.route)
      .map((page) => {
        this.log.start(`Creating Route ${page.route || page.name}`, {
          page: _.pick(page, [
            'name', 'route', 'get',
          ]),
        });

        // Have one router per page
        Object.assign(page, {
          router: express.Router({ // eslint-disable-line
            mergeParams: true,
          }),
        });

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

    // Sort routes to allow:
    // /api/user/:id/edit
    // /api/user/:id

    if (routes.length === 0) {
      const err = cannot('setup', 'routes')
        .because('there aren\'t any')
        .addInfo('Maybe there is no entry point, like an index.html.');

      if (this.isDEV) {
        this.log.error(err.message, err);
      } else {
        throw err;
      }
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
              this.log.debug(`No handler for ${method.toUpperCase()} ${page.route}`);
              return;
            }

            const send = handlers.pop();

            const sendClosure = (req, res, next) => Promise.resolve()
              .then(() => send(req, res, page, { /* data */}))
              .catch((err) => next(err));

            if (!send) {
              this.log.error('No send method.');
            }

            Object.assign(page, {
              [method]: sendClosure,
            });

            if (page.key.mount.value === true) {
              const finalRoutes = ['']
                .concat(handlers)
                .concat(sendClosure);

              page.router[method].apply(
                page.router,
                finalRoutes
              );

              this.log.success(
                `Set up ${method.toUpperCase()} controller for ${page.route}`
              );
            }
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
 * TODO: Rename to loadWrappedFn()
 *       and/or use custom require wrapper with aden/server in module scope
 */
function loadCustom(key, pageScope) {
  const filePath = key.value && key.build
    ? key.dist
    : key.resolved;

  this.log.info(`load custom ${filePath}`);
  try {
    if (this.isDEV) {
      require.cache[require.resolve(filePath)] = null;
    }

    const wrapper = this.nativeRequire(filePath);

    if (typeof wrapper !== 'function') {
      const err = cannot('load', 'custom handler')
        .because('the wrapper is not a function')
        .addInfo(typeof wrapper)
        .addData(wrapper);

      if (this.isDEV) {
        this.log.warn(err.message);
        return () => true;
      }
      throw err;
    }

    const fn = wrapper(this, pageScope);

    return fn;
  } catch (ex) {
    this.log.error(`Error loading custom handler at ${filePath}`, ex);
    return null;
  }
}

module.exports = {
  loadCustom,
  setupApp,
  notFoundRoute,
  errorRoute,
  setupRoutes,
  defaultErrorResponse,
};
