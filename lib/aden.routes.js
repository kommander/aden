'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const DEV_ENV = process.env.NODE_ENV === 'development';

function setupApp(rootPage) {
  this.router = express.Router(); // eslint-disable-line

  if (rootPage.serveStatics === true) {
    this.app.use(rootPage.basePath,
      express.static(path.resolve(rootPage.dist, 'public')));
  }

  // Serve favicon.ico
  if (this.rootConfig.favicon) {
    const favicon = fs.readFileSync(this.rootConfig.favicon);
    const faviconRoute = `${rootPage.basePath}favicon.ico`;
    this.app.use(faviconRoute, (req, res) => {
      res.setHeader('Content-Type', 'image/x-icon');
      res.send(favicon);
    });
  }

  // TODO: Distinct between private/public interface routers

  return this.executeHook('pre:setup', { aden: this, rootPage, router: this.router })
    .then(() => this.setupRoutes(this.router, [rootPage].concat(this.defaultPages)))
    .then(() => {
      // Note: The router needs to be wrapped here to allow switching out in dev
      this.app.use(rootPage.basePath, (req, res, next) => this.router(req, res, next));

      // Last, add a not found handler if given
      if (this.notFoundPage) {
        this.app.use((req, res, next) => {
          this.notFoundRoute(req, res, next);
        });
      }

      if (this.errorPage) {
        this.app.use(rootPage.basePath, (err, req, res, next) => {
          this.errorRoute(err, req, res, next);
        });
      }
    })
    .then(() => this.executeHook('post:setup', { aden: this, rootPage, router: this.router }));
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
  this.logger.error('App Error:', err);

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500);
  this.sendPage(req, res, this.errorPage, { err })
    .catch(errPageErr => {
      this.logger.error('Error Page Broken :/', errPageErr);
      process.exit(1);
    });
}

function setupRoutes(router, pages) {
  return Promise.resolve().then(() => {
    const routes = this.reducePages(pages)
      .filter((page) => page.route
        && page.route.length > 0
        && (page.htmlFileFullPath || page.render)
      )
      .sort((a, b) => {
        if (a.greedyRoutes && !b.greedyRoutes) {
          return 1;
        }
        if (!a.greedyRoutes && b.greedyRoutes) {
          return -1;
        }
        return 0;
      })
      .map((page) => {
        // TODO: Handle reserved page names elsewhere...
        if (page.name === this.rootConfig.error) {
          this.errorPage = page;

          if (DEV_ENV) {
            return this.setupRoute(router, page);
          }
        }

        if (page.name === this.rootConfig.notFound) {
          this.notFoundPage = page;

          if (DEV_ENV) {
            return this.setupRoute(router, page);
          }
        }

        return this.setupRoute(router, page);
      });

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

// TODO: Allow route params like /user/:id !!!
function setupRoute(router, page, data) {
  return Promise.resolve({ page, routes: [page.route], handlers: [], data })
    .then((args) => {
      this.logger.start(`Setting up routes ${args.routes}`);
      return args;
    })
    .then((args) => this.executeHook('pre:route', args))
    .then((args) => {
      // Handle the page route
      args.handlers.push((req, res, next) => {
        const accepts = (req.header('accept') || '')
          .split(',')
          .filter((item) => item.trim().match(/text\/html|application\/json/i));

        if (accepts.length > 0) {
          return this.sendPage(req, res, args.page, args.data)
            .catch((err) => next(err));
        }

        this.logger.debug(`Dropping Request for ${args.routes}`, req.header('accept'));
        return next();
      });

      // TODO: gather all routes before applying them and optimize the order
      //       to put greedy routes last
      if (page.greedyRoutes === true) {
        args.routes = args.routes.map((route) => `${route}*`); // eslint-disable-line
      }

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
