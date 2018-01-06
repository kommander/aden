const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');
const Logger = require('../../../lib/aden.logger');
const TestDuplex = require('../../lib/test-duplex.js');

describe('Routing Dev', () => {
  she.skip('creates default route without specific config', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(200, () => {
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('does not route pages with { route: false; } > .server', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/notaroute')
          .expect(404, () => {
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('matches greedy routes', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/greedy/matched/by/something.possible')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(200);
            expect(res.text).toMatch(/greedy content/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('puts greedy routes at the end of the router stack', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/greedy/overrides/')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(200);
            expect(res.text).toMatch(/test content/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('allows params in page path /user/+id/edit', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/user/_test_id_')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(200);
            expect(res.text).toMatch(/_test_id_/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('logs an error if no routes are given', (done) => {
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
      attitudes: '!statuspages',
    });

    logParser.on('error', (err) => {
      expect(err.message).toMatch(/I could not setup routes/);
      done();
    });

    adn.init(path.resolve(__dirname, '../tmpdata/noroutes'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown())
      .catch(done);
  });

  she.skip('does not serve controllers, if .server { route: false }', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/nocontroller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/notroute/')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('does not route empty subpaths', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/emptypath'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/api/')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(404);
            request(an.app)
              .get('/api/user/')
              .end((err2, res2) => {
                if (err2) { done(err); return; }
                expect(res2.status).toBe(200);
                an.shutdown(done);
              });
          });
      })
      .catch(done);
  });

  she.skip('has a core status page (404)', (done) => {
    aden({ 
      dev: true,
      attitudes: ['!statuspages'],
    })
    .init(path.resolve(__dirname, '../tmpdata/emptypath'))
    .then((an) => an.run('dev'))
    .then((an) => {
      request(an.app)
        .get('/')
        .end((err, res) => {
          if (err) done(err);
          expect(res.status).toBe(404);
          expect(res.text).toMatch(/Could not find what you were looking for\./ig);
          an.shutdown(done);
        });
    })
    .catch(done);
  });

  she.skip('core error route returns when headers already sent (500)', (done) => {
    aden({ 
      dev: true,
      attitudes: ['!statuspages'],
    })
    .hook('post:setup', ({ app }) => {
      app.use((err, req, res, next) => {
        res.send('errrrr');
        next(err);
      });
    })
    .init(path.resolve(__dirname, '../tmpdata/custom/provoke'))
    .then((an) => an.run('dev'))
    .then((an) => {
      request(an.app)
        .get('/')
        .end((err, res) => {
          if (err) done(err);
          expect(res.text).toMatch(/errrrr/ig);
          an.shutdown(done);
        });
    })
    .catch(done);
  });

  she('// Things Aden already does but are untested...');
  she('allows params in { route: \'/:id\'} > .server');
  she('mounts absolute routes absolute');
});
