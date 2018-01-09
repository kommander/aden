const aden = require('../../lib/aden')
const Logger = require('../../lib/aden.logger')
const path = require('path')
const expect = require('expect')
const sinon = require('sinon')
const spawn = require('../lib/spawn')
const TestDuplex = require('../lib/test-duplex.js')

describe('Logger', () => {
  afterEach((done) => {
    spawn.anakin(done)
  })

  she('has a log', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an).toIncludeKey('log')
        an.shutdown(done)
      })
      .catch(done)
  })

  she('has a log with all methods needed', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.log).toIncludeKey('debug')
        expect(an.log).toIncludeKey('info')
        expect(an.log).toIncludeKey('warn')
        expect(an.log).toIncludeKey('error')
        expect(an.log).toIncludeKey('start')
        expect(an.log).toIncludeKey('success')
        an.shutdown(done)
      })
      .catch(done)
  })

  she('has a silent log by default', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.info('text')
      expect(stream.write.called).toEqual(0)
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs debug level messages', (done) => {
    const stream = new TestDuplex() // <- test stream, where logs get written to (not visible in console)
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        debug: true,
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('debug', (obj) => {
        expect(obj.msg).toMatch('debugtext')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.debug('debugtext')
    })
    .catch(done)
  })

  she('logs debug level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        debug: true,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('debug', (obj) => {
        expect(obj.msg).toMatch('debugtext')
        expect(obj.data.add).toMatch('debug')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.debug('debugtext', { add: 'debug' })
    })
    .catch(done)
  })

  she('logs info level messages', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.info('infotext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(stream.write.calledWithMatch(/\{"msg":"infotext"\}/)).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs info level messages (without debug object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('info', (obj) => {
        expect(obj.data).toBe(undefined)
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.info('infotext', { add: 'info' })
    })
    .catch(done)
  })

  she('logs info level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        debug: true,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('info', (obj) => {
        expect(obj.msg).toMatch('infotext')
        expect(obj.data.add).toMatch('info')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.info('infotext', { add: 'info' })
    })
    .catch(done)
  })

  she('logs warn level messages', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.warn('warntext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(stream.write.calledWithMatch(/\{"msg":"warntext"\}/)).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs error level messages', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.error('errortext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(stream.write.calledWithMatch(/\{"msg":"errortext"\}/)).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs warn level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        debug: true,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('warn', (obj) => {
        expect(obj.data.add).toMatch('info')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.warn('warntext', { add: 'info' })
    })
    .catch(done)
  })

  she('logs error level messages (with Error Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('error', (err) => {
        expect(err.message).toMatch('failed')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.error('errortext', new Error('failed'))
    })
    .catch(done)
  })

  she('logs error level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        debug: true,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('error', (err, obj) => {
        expect(obj.data.stuff).toMatch('data')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.error('errortext', new Error('failed'), { stuff: 'data' })
    })
    .catch(done)
  })

  she('logs start level messages', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.start('starttext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(stream.write.calledWithMatch(/\{"msg":"starttext"\}/)).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs start level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        debug: true,
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('start', (obj) => {
        expect(obj.data.add).toMatch('start')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.start('starttext', { add: 'start' })
    })
    .catch(done)
  })

  she('logs success level messages', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.success('successtext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(stream.write.calledWithMatch(/\{"msg":"successtext"\}/)).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs success level messages (with debug Object)', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        debug: true,
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('success', (obj) => {
        expect(obj.data.add).toMatch('success')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.success('successtext', { add: 'success' })
    })
    .catch(done)
  })

  she('logs raw messages', (done) => {
    const stream = new TestDuplex()
    const logParser = Logger.getLogParser()
    logParser.attach(stream)

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      logParser.once('raw', (str) => {
        expect(str).toMatch('rawtext')
        expect(str).toBeA('string')
        logParser.destroy()
        an.shutdown(done)
      })
      an.log.raw('rawtext')
    })
    .catch(done)
  })

  she('throws and error for a namespace without name', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(() => an.log.namespace(null)).toThrow()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('throws and error for a namespace with space in name', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(() => an.log.namespace('not a namespace')).toThrow()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('can create a new namespace from a log', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(() => an.log.namespace('test')).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('has a ready event in log', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/basics'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const logParser = Logger.getLogParser()
    logParser.attach(child.stdout)
    logParser.attach(child.stderr)
    logParser.on('error', done)
    logParser.on('ready', () => {
      logParser.destroy()
      done()
    })
  })

  she('provides address/port to ready', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/basics'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const logParser = Logger.getLogParser()
    logParser.attach(child.stdout)
    logParser.attach(child.stderr)
    logParser.on('error', done)
    logParser.on('ready', (info) => {
      expect(info.port).toBe(5000)
      expect(info).toIncludeKey('address')
      logParser.destroy()
      done()
    })
  })

  she('overrides the silent setting with env ADEN_FORCE_LOG=true', (done) => {
    const stream = {
      write: sinon.spy()
    }

    process.env.ADEN_FORCE_LOG = true

    aden({
      dev: true,
      logger: {
        silent: true,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(stream.write.callCount).toBeGreaterThan(1)
      process.env.ADEN_FORCE_LOG = false
      an.shutdown(done)
    })
    .catch(done)
  })

  she('logs a date', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.success('successtext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(
        stream.write
          .calledWithMatch(
            /[\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2}\.[\d]{1,3}/
          )
      ).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })

  she('can omit the date', (done) => {
    const stream = {
      write: sinon.spy()
    }

    aden({
      dev: true,
      logger: {
        noDate: true,
        silent: false,
        stdStream: stream
      }
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.success('successtext')
      expect(stream.write.callCount).toBeGreaterThan(1)
      expect(
        !stream.write
          .calledWithMatch(
            /[\d]{4}-[\d]{2}-[\d]{2} [\d]{2}:[\d]{2}:[\d]{2}\.[\d]{1,3}/
          )
      ).toBeTruthy()
      an.shutdown(done)
    })
    .catch(done)
  })
})
