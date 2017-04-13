'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const cannot = require('cannot');
const _ = require('lodash');

// TODO: take app as argument
function setupApp(rootPage) {
  // TODO: Use a router per entry point
  this.router = express.Router(); // eslint-disable-line

  // header
  // TODO: Move to plugin (loaded by default)
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
    const from = path.resolve(rootPage.resolved.dist, 'public');
    this.logger.debug(`Serving statics from ${from}`);

    // TODO: + publicPath
    this.app.use(rootPage.basePath, express.static(from));
  }

  // Serve favicon.ico
  // TODO: Move to plugin (loaded by default)
  if (rootPage.favicon) {
    this.logger.debug(`Serving favicon from ${rootPage.favicon}`);

    const favicon = fs.readFileSync(rootPage.resolved.favicon);
    const faviconRoute = `${rootPage.basePath}favicon.ico`;
    this.app.use(faviconRoute, (req, res) => {
      res.setHeader('Content-Type', 'image/x-icon');
      res.send(favicon);
    });
  }

  return this.applyHook('pre:setup', { aden: this, rootPage, router: this.router })
    .then(() => this.setupRoutes(this.router, [rootPage].concat(this.defaultPages)))
    .then(() => {
      // Note: The router needs to be wrapped here to allow switching out in dev
      this.logger.debug('Setting up base router');
      this.app.use(rootPage.basePath, (req, res, next) => this.router(req, res, next));

      // Last, add a not found handler if given
      if (this.notFoundPage) {
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

      if (this.errorPage) {
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
          this.logger.error('(No Error Page Handler)', err);
          res.status(500);
          res.end('Error');
          return next();
        });
      }
    })
    .then(() => this.applyHook('post:setup', { aden: this, rootPage, router: this.router }));
}

function notFoundRoute(req, res, next) {
  if (res.headersSent) {
    this.logger.warn('404 headers already sent.');
    next();
    return;
  }

  res.status(404);
  if (req.headers.accept && req.headers.accept.match('text/html')) {
    this.sendPage(req, res, this.notFoundPage);
  } else {
    res.end();
  }
}

function errorRoute(err, req, res, next) {
  this.logger.error('Unhandled:', err);

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(err.status || 500);

  this.sendPage(req, res, this.errorPage, { err })
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
        // TODO: Handle reserved page names elsewhere...
        if (page.name === this.rootConfig.error) {
          this.logger.debug('Choosing Error Page', _.pick(page, [
            'name',
            'path',
          ]));
          this.errorPage = page;
        }

        if (page.name === this.rootConfig.notFound) {
          this.logger.debug('Choosing Not Found Page', _.pick(page, [
            'name',
            'path',
          ]));
          this.notFoundPage = page;
        }

        return page;
      })
      .filter((page) => page.route
        && page.route.length > 0
        && (
          page.htmlFileFullPath
          || page.send
        )
      )
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
      .map((page) => this.setupRoute(router, page));

    if (routes.length === 0) {
      throw cannot('setup', 'routes')
        .because('there aren\'t any')
        .addInfo('Maybe there is no entry point, like an index.html.');
    }

    // Gather all routes async, then apply them in order to the router
    return Promise.all(routes)
      .then((results) => {
        // TODO: Are we only ever handling get requests?
        //       POST requests should be proxied to their respective API endpoints?
        results.forEach((args) => {
          router.get.apply(router, args.handlers);
          this.logger.success(`Set up routes ${args.routes}`);
        });
      });
  });
}

// TODO: rename to createRoute(?)
function setupRoute(router, page, data) {
  return Promise.resolve({ page, routes: [page.route], handlers: [], data })
    .then((args) => {
      this.logger.start(`Creating Route ${args.routes}`, {
        page: _.pick(page, [
          'name',
          'route',
          'send',
        ]),
        routes: args.routes,
      });
      return args;
    })
    .then((args) => this.applyHook('pre:route', args))
    .then((args) => {
      // Handle the page route
      args.handlers.push((req, res, next) => {
        const accepts = (req.header('accept') || '')
          .split(',')
          .filter((item) => item.trim().match(/text\/html|application\/json/i));

        if (accepts.length > 0) {
          return Promise.resolve()
            .then(() => this.sendPage(req, res, args.page, args.data))
            .catch((err) => next(err));
        }

        this.logger.debug(`Dropping Request for ${args.routes}`, req.header('accept'));
        return next();
      });

      this.routes.push(args.routes);

      args.handlers.unshift(args.routes);

      return args;
    });
}

module.exports = {
  setupApp,
  notFoundRoute,
  errorRoute,
  setupRoutes,
  setupRoute,
};
