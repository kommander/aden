const aden = require('../../lib/aden');
const logger = require('../../lib/aden.logger');
const path = require('path');
const expect = require('expect');
const sinon = require('sinon');

describe('Logger', () => {
  she('has a log', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an).toIncludeKey('log');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('has a log with all methods needed', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.log).toIncludeKey('debug');
        expect(an.log).toIncludeKey('info');
        expect(an.log).toIncludeKey('warn');
        expect(an.log).toIncludeKey('error');
        expect(an.log).toIncludeKey('start');
        expect(an.log).toIncludeKey('success');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('has a silent log by default', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.info('text');
      expect(stream.write.called).toEqual(0);
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs debug level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        debug: true,
        silent: false,
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.info('text');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/text\n/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs info level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.info('infotext');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/infotext\n/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs warn level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.warn('warntext');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/warntext/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs error level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.error('errortext');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/errortext/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs start level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.start('starttext');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/starttext\n/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });

  she('logs success level messages', (done) => {
    const stream = {
      write: sinon.spy(),
    };

    aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
      },
    })
    .init(path.resolve(__dirname, '../tmpdata/basics'))
    .then((an) => an.run('dev'))
    .then((an) => {
      an.log.success('successtext');
      expect(stream.write.callCount).toBeGreaterThan(1);
      expect(stream.write.calledWithMatch(/successtext\n/)).toBeTruthy();
      an.shutdown(done);
    })
    .catch(done);
  });
});
