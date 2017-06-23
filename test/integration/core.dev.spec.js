const aden = require('../../lib/aden');
const express = require('express');
const path = require('path');
const expect = require('expect');
const request = require('supertest');
const Logger = require('../../lib/aden.logger');
const TestDuplex = require('../lib/test-duplex.js');

describe('Core Dev', () => {
  she('provides a startup callback', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('startup:callback', (data) => {
      expect(data).toBe('blub!');
    });

    adn.init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('takes existing express app', (done) => {
    const app = express();

    app.get('/manual-route', (req, res, next) => {
      res.send('manual');
    });

    aden(app, { dev: true })
      .init(path.resolve(__dirname, '../tmpdata/emptypath'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/manual-route')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/manual/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('logs a warning when multiple dot server files are present', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('warn', (data) => {
      expect(data.msg).toMatch(/Multiple server config files, using/);
    });

    adn.init(path.resolve(__dirname, '../tmpdata/multidotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('logs a warning for an invalid .server file', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('error', (err) => {
      expect(err.message).toMatch(/Unexpected token n in JSON at position/);
    });

    adn.init(path.resolve(__dirname, '../tmpdata/brokendotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('exposes aden.server in startup callback', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('calls startup hooks for subpages');

  // (static entry point templates go into public build)
  she('distincts between static and dynamic entry points');

  // docs/quotemachine/api/quote/quote.js
  she('clears the cache for changed modules used by controllers');

  she('does not try to load invalid .server files multiple times until it is changed');

  she('// Things Aden already does but are untested...');
  she('takes ignores from .server, applied to subpath only');
  she('calls a build hook for keys marked as build');
  she('resolves dist and distFileName for keys marked as build');
  she('resolves dist and distFileName for file array keys marked as build');
  she('ignores dot files/folders for page parsing');
  she('does not expose bare assets from page tree');
});
