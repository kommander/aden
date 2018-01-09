'use strict'

const express = require('express')
const path = require('path')
const cannot = require('brokens')
const _ = require('lodash')

const supportedMethods = [
  'checkout', 'copy', 'delete', 'get', 'head', 'lock', 'merge', 'mkactivity', 'mkcol', 'move',
  'notify', 'options', 'patch', 'post', 'purge', 'put', 'report', 'search',
  'subscribe', 'trace', 'unlock', 'unsubscribe', 'all'
]

function setupApp (pages) {
  // TODO: Use a router per entry point
  this.router = express.Router({ // eslint-disable-line
    mergeParams: true
  })

  // header
  // TODO: Move to attitude
  if (typeof pages[0].poweredBy === 'string') {
    this.app.disable('x-powered-by')
    this.app.use((req, res, next) => {
      res.set({
        'X-Powered-By': this.settings.poweredBy
      })
      next()
    })
  }

  // Statics are needed to be served at least for development
  if (pages[0].serveStatics === true) {
    this.log.start(`Serving statics at ${pages[0].basePath}`)
    const from = path.resolve(this.settings.dist, 'public')
    this.log.debug(`Serving statics from ${from}`)

    // TODO: + publicPath
    this.app.use(pages[0].basePath, express.static(from, {
      // redirect: false,
    }))
  }

  return this.applyHook('setup', { pages, app: this.app })
    .then(({ pages }) => this.setupRoutes(this.router, pages))
    .then(() => {
      this.log.debug('Setting up base router')

      if (this.isDEV) {
        // Note: The router needs to be wrapped here to allow switching out in dev
        this.app.use(pages[0].basePath, (req, res, next) => {
          this.router(req, res, next)
        })
      } else {
        this.app.use(pages[0].basePath, this.router)
      }
    })
    .then(() => this.applyHook('post:setup', { pages, app: this.app }))
    .then(() => {
      this.app.use((req, res, next) => this.notFoundRoute(req, res, next))
      this.app.use((err, req, res, next) =>
        this.errorRoute(err, req, res, next))
    })
}

function notFoundRoute (req, res, next) {
  if (res.headersSent) {
    this.log.warn('404 headers already sent.')
    return
  }

  res.status(404)

  if (!res.headersSent) {
    res.status(404)
    res.send('Could not find what you were looking for.')
  }
}

function errorRoute (err, req, res, next) {
  this.log.error('Unhandled:', err)

  if (res.headersSent) {
    return
  }

  if (res.statusCode === 200) {
    res.status(err.status || 500)
  }

  if (!res.headersSent) {
    res.status(500)
    if (this.isDEV) {
      res.send(`<pre>${err.stack || err}</pre>`)
    } else {
      res.send('Internal Server Error')
    }
  }
}

function setupRoutes (router, pages) {
  return Promise.resolve()
  .then(() => this.walkPages(pages,
    (walkPage) => this.applyHook('setup:page', { page: walkPage })
  ))
  .then(() => {
    const routes = pages
      .filter((page) => page.route)
      .map((page) => {
        this.log.start(`Processing Route ${page.route || page.name}`, {
          page: _.pick(page, [
            'name', 'route', 'get'
          ])
        })

        // Have one router per page
        Object.assign(page, {
          router: express.Router({ // eslint-disable-line
            mergeParams: true
          })
        })

        return page
      })
      .sort((a, b) => {
        // Put greedy routes to the back to allow explicit routes to be matched
        if (a.greedy && !b.greedy) {
          return 1
        }
        if (!a.greedy && b.greedy) {
          return -1
        }
        return 0
      })
      .map((page) => this.applyHook('setup:route', { router, page }))

    // Sort routes to allow:
    // /api/user/:id/edit
    // /api/user/:id

    if (routes.length === 0) {
      const err = cannot('setup', 'routes')
        .because('there aren\'t any')
        .addInfo('Maybe there is no entry point, or no Attitude handling a file.')

      if (this.isDEV) {
        this.log.error(err.message, err)
      } else {
        throw err
      }
    }

    // Gather all routes async, then mount them in order on the router
    return Promise.all(routes)
      .then((results) => {
        const pagesAgain = results.map(({ page }) => {
          // controllers for get/post/put/delete/all/... requests
          page.methods.value.forEach((method) => {
            let handlers = page[method] || []

            // Send string data
            // Move all that resolving of the controller per page to controller attitude
            // Could be an Express attitude as well, to make controller handling more raw
            // and allow for using koa.
            //
            if (typeof handlers === 'string') {
              const str = handlers
              handlers = [(req, res) => res.send(str)]
            } else if (typeof handlers === 'function') {
              handlers = [handlers]
            } else if (handlers instanceof Promise) {
              throw cannot('use', 'method handler')
                .because('Promise wrapped handlers must be resolved before')
            }

            if (handlers.length === 0) {
              this.log.debug(`No handler for ${method.toUpperCase()} ${page.route}`)
              return
            }

            const send = handlers.pop()
            if (!send) {
              this.log.error('No send method.', { handlers })
            }

            // An async controller can timeout if an async error is swallowed somewhere or it
            // just does never resolve. Timeout the controller and send correct response
            const sendClosure = (req, res, next) => Promise.resolve()
              .then(() => send(req, res, page, { /* data */}))
              .catch((err) => next(err))

            Object.assign(page, {
              [method]: sendClosure
            })

            if (page.mount.value === true) {
              const finalRoutes = ['']
                .concat(handlers)
                .concat(sendClosure)

              page.router[method].apply(
                page.router,
                finalRoutes
              )

              this.log.success(
                `Set up ${method.toUpperCase()} controller for ${page.route}`
              )
            }
          })

          if (page.route && page.route.length > 0) {
            const pageRoutes = [].concat([page.route])
            pageRoutes.forEach((route) => router.use(route, page.router))
          }

          return page
        })

        return { router, pages: pagesAgain }
      })
  })
}

/**
 * Loads a function wrapped module and hands over aden and the page in scope
 * TODO: Sandbox custom components (put in separate context/isolate, or xipc)
 * TODO: use custom require wrapper with aden/server in module scope
 * TODO: Implement with keys, to make a key fail on wrapper load fail
 *       and not mount the route if no entry point level keys are present
 */
function loadWrappedFn (key, pageScope) {
  const filePath = key && key.value && key.build
      ? key.dist
      : key.resolved

  return Promise.resolve().then(() => {
    this.log.info(`loading wrapped function ${filePath}`)

    if (this.isDEV) {
      require.cache[require.resolve(filePath)] = null
    }

    const wrapper = this.nativeRequire(filePath)

    if (typeof wrapper !== 'function') {
      const err = cannot('load', 'custom handler')
        .because('the wrapper is not a function')
        .addInfo(typeof wrapper)
        .addData(wrapper)

      if (this.isDEV) {
        this.log.warn(err.message)
        return () => true
      }

      throw err
    }

    return this.unpackWrappedFn(wrapper, pageScope)
  })
  .catch((err) => {
    this.log.error(`Error loading custom handler at ${filePath}`, err)
    return null
  })
}

function unpackWrappedFn (wrapper, pageScope) {
  return Promise.resolve()
    .then(() => wrapper(this, pageScope))
    .catch((ex) => {
      this.log.error('Error unpacking wrapped Function', ex)
      return null
    })
}

module.exports = {
  supportedMethods,
  loadWrappedFn,
  unpackWrappedFn,
  setupApp,
  notFoundRoute,
  errorRoute,
  setupRoutes
}
