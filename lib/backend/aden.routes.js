'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const DEV_ENV = process.env.NODE_ENV === 'development';

function setupApp(rootPage) {
  this.router = express.Router(); // eslint-disable-line

  // TODO: Distinct between private/public interface routers

  return this.executeHook('pre:setup', { aden: this, rootPage, router: this.router })
    .then(() => this.setupRoutes(this.router, [rootPage].concat(this.defaultPages)))
    .then(() => {
      // Serve favicon.ico
      if (this.rootConfig.favicon) {
        const favicon = fs.readFileSync(this.rootConfig.favicon);
        const faviconRoute = `${rootPage.basePath}favicon.ico`;
        this.app.use(faviconRoute, (req, res) => {
          res.setHeader('Content-Type', 'image/x-icon');
          res.send(favicon);
        });
      }

      this.app.use(rootPage.basePath, (req, res, next) => this.router(req, res, next));

      if (rootPage.serveStatics === true) {
        this.app.use(rootPage.basePath,
          express.static(path.resolve(rootPage.dist, 'public')));
      }

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
  this.logger.warn(`404 ${req.path} (${req.headers.referer || req.headers.host})`, req);

  // Allow multiple aden apps, only use the last handler
  if (this.allApps.length > 1) {
    if (typeof req.notFoundCount === 'undefined') {
      req.notFoundCount = 0; // eslint-disable-line
    }
    req.notFoundCount++;  // eslint-disable-line
    if (req.notFoundCount < this.allApps.length) {
      next();
      return;
    }
  }

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
  this.logger.warn(`Handling error (${err.stack || err})`, err || {});

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500);
  this.sendPage(req, res, this.errorPage, { err })
    .catch(errPageErr => {
      console.log('Error Page Broken. Exiting.', errPageErr);
      process.exit(1);
    });
}

function setupRoutes(router, pages) {
  return Promise.resolve().then(() => {
    const routes = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Handle reserved page names...
      if (page.name === this.rootConfig.error) {
        this.errorPage = page;

        if (DEV_ENV) {
          routes.push(this.setupRoute(router, page));
          continue;
        }
      }

      if (page.name === this.rootConfig.notFound) {
        this.notFoundPage = page;

        if (DEV_ENV) {
          routes.push(this.setupRoute(router, page));
          continue;
        }
      }

      if (page.route && page.htmlFile) {
        routes.push(this.setupRoute(router, page));
      }
    }
    return Promise.all(routes);
  });
}

// TODO: Allow route params like /user/:id !!!
function setupRoute(router, page, data) {
  return Promise.resolve({ page, routes: [page.route], handlers: [], data })
    .then((args) => {
      this.logger.start(`Setting up route ${page.route}`);
      return args;
    })
    .then((args) => this.executeHook('pre:route', args))
    .then((args) => {
      args.handlers.push((req, res) => {
        this.logger.debug(`Serving page ${page.route}`);
        this.sendPage(req, res, args.page, args.data);
      });

      this.routes.push(args.routes);
      args.handlers.unshift(args.routes);

      // TODO: Are we only handling get requests?
      //       POST requests should be proxied to their respective API endpoints?
      router.get.apply(router, args.handlers);
    })
    .then(() => this.logger.success(`Set up route ${page.route}`))
    .then(() => this.setupRoutes(router, page.children));
}

module.exports = {
  setupApp,
  notFoundRoute,
  errorRoute,
  setupRoutes,
  setupRoute,
};
