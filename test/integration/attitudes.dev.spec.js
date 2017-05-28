const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');
const Logger = require('../../lib/aden.logger');
const TestDuplex = require('../lib/test-duplex.js');
const sinon = require('sinon');

describe('Attitudes API', () => {
  she('allows to load app level attitudes', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/attitudes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('customAttitudeKey');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('logs a warning when attitudes path is not available', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      attitudesPath: 'not-a-path', // <-
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    const spy = sinon.spy((json) => {
      expect(json.msg).toMatch(/Trying to load attitudes from ENOENT/);
    });

    logParser.once('warn', spy);

    adn.init(path.resolve(__dirname, '../tmpdata/noroutes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(spy.calledOnce).toBeTruthy();
        an.shutdown(done);
      })
      .catch(done);
  });

  she('logs a warning when an attitude could not be resolved', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      attitudes: ['not-an-attitude'], // <-
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    const spy = sinon.spy((json) => {
      expect(json.msg).toMatch(/I could not load attitude/);
    });

    logParser.once('warn', spy);

    adn.init(path.resolve(__dirname, '../tmpdata/noroutes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(spy.calledOnce).toBeTruthy();
        an.shutdown(done);
      })
      .catch(done);
  });

  she('allows to load attitudes from absolute paths', (done) => {
    aden({
      dev: true,
      attitudes: [path.resolve(__dirname, '../tmpdata/attitudes/.attitudes/custom.js')],
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(an.rootPage.key).toIncludeKey('customAttitudeKey');
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs a warning when an attitude is not a function', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      attitudes: [path.resolve(__dirname, '../tmpdata/attitudes/.attitudes/invalid.js')],
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    const spy = sinon.spy((json) => {
      expect(json.msg).toMatch(/Invalid attitude at/);
    });

    logParser.once('warn', spy);

    adn.init(path.resolve(__dirname, '../tmpdata/noroutes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(spy.calledOnce).toBeTruthy();
        an.shutdown(done);
      })
      .catch(done);
  });
});
