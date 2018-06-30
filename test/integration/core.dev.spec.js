const aden = require('../../lib/aden')
const path = require('path')
const expect = require('expect')
const Logger = require('../../lib/aden.logger')
const TestDuplex = require('../lib/test-duplex.js')
const spawn = require('../lib/spawn')

describe('Core Dev', () => {
  afterEach((done) => {
    spawn.anakin(done)
  })

  she('provides a startup callback', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })

    logParser.once('startup:callback', (data) => {
      expect(data).toBe('blub!')
    })

    adn.init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done))
  })

  she('logs a warning when multiple dot server files are present', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })

    logParser.once('warn', (data) => {
      expect(data.msg).toMatch(/Multiple server config files, using/)
    })

    adn.init(path.resolve(__dirname, '../tmpdata/multidotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done))
  })

  she('logs an error for an invalid .server file', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })

    logParser.once('error', (err) => {
      expect(err.message).toMatch(/Unexpected token n in JSON at position/)
    })

    adn.init(path.resolve(__dirname, '../tmpdata/brokendotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done))
  })

  she('calls load hook only once per page', (done) => {
    const pagesLoaded = []

    aden({ dev: true })
      .hook('load', ({ page }) => {
        if (pagesLoaded.includes(page.id)) {
          throw new Error('Page loaded multiple times')
        }
        pagesLoaded.push(page.id)
      })
      .init(path.resolve(__dirname, '../tmpdata/dev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        an.shutdown(done)
      })
      .catch(done)
  })

  she('calls startup hooks for subpages')

  // (static entry point templates go into public build)
  she('distincts between static and dynamic entry points')

  // docs/quotemachine/api/quote/quote.js
  she('clears the cache for changed modules used by controllers')

  she('// Things Aden already does but are untested...')
  she('takes ignores from .server, applied to subpath only')
  she('calls a build hook for keys marked as build')
  she('resolves dist and distFileName for keys marked as build')
  she('resolves dist and distFileName for file array keys marked as build')
  she('ignores dot files/folders for page parsing')
  she('does not expose bare assets from page tree')
})
