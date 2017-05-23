const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Routing Dev', () => {
  she('creates default route without specific config', (done) => {
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

  she('adds route from .server to page path route', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/configured/manual')
          .expect(200, () => {
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('adds route from .server to page path route (no slash)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/configured2/noslash')
          .expect(200, () => {
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('does not route pages with { route: false; } > .server', (done) => {
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

  she('matches greedy routes', (done) => {
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

  she('puts greedy routes at the end of the router stack', (done) => {
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

  she('allows params in page path /user/+id/edit', (done) => {
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

  she('// Things Aden already does but are untested...');
  she('allows params in { route: \'/:id\'} > .server');
});
