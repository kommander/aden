const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('HBS Dev', () => {
  she('has a root route with index.hbs entry point', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
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

  she('delivers index.hbs at root path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^<!DOCTYPE html>/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('delivers index.hbs at sub path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^subsub/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('wraps hbs in given layout (layout.default.html|hbs|md)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('works without layout attitude active (hbs)', (done) => {
    aden({ dev: true, attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('works with layout inactive for hbs (nolayout)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs/nolayout'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('includes images in the build (hbs)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/images/test.png')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      });
  });

  she('includes images required from sub path in the build (hbs)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/images/sub-test.png')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      });
  });

  she('injects commons in hbs (layout inactive)', (done) => {
    aden({ dev: true, attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/commons.js/ig);
            an.shutdown(done);
          });
      });
  });

  she('injects commons in hbs (nolayout)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/nolayout')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/commons.js/ig);
            an.shutdown(done);
          });
      });
  });
});
