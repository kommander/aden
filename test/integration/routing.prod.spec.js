const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Routing Prod', () => {
  she('creates default route without specific config', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/routes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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

  she('throws an error when routes are empty', (done) => {
    const adn = aden();
    adn.init(path.resolve(__dirname, '../tmpdata/noroutes'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .catch((err) => {
        expect(err.message).toMatch(/I could not setup routes/);
        adn.shutdown(done);
      });
  });

  she('does not serve controllers, if .server { route: false }', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/nocontroller'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/notroute')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('does not route empty subpaths', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/emptypath'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/api')
          .end((err, res) => {
            if (err) { done(err); return; }
            expect(res.status).toBe(404);
            request(an.app)
              .get('/api/user')
              .end((err2, res2) => {
                if (err2) { done(err); return; }
                expect(res2.status).toBe(200);
                an.shutdown(done);
              });
          });
      })
      .catch(done);
  });

  she('// Things Aden already does but are untested...');
  she('allows params in { route: \'/:id\'} > .server');
  she('mounts absolute routes absolute');
});
