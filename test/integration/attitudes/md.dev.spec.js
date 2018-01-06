const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe.skip('MD Markdown Attitude Dev', () => {
  she('has a root route with index.md entry point', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(200, () => {
            an.shutdown(done);
          });
      });
  });

  she('delivers index.md at root path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Hello marked/ig);
            an.shutdown(done);
          });
      });
  });

  she('delivers index.md at sub path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toEqual(200);
            expect(res.text).toMatch(/Sub Page/ig);
            an.shutdown(done);
          });
      });
  });

  she('delivers additional md files at page path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/another.html')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Just a file/ig);
            an.shutdown(done);
          });
      });
  });

  she('delivers additional md files at page sub path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub/additional.html')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/yet another page/ig);
            an.shutdown(done);
          });
      });
  });

  she('wraps md in given layout (layout.default.html|hbs|md)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('does not wrap subpage md in given layout (layout.default.html|hbs|md)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap/sub/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('works without layout attitude active', (done) => {
    aden({ dev: true, attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('works for additionals without layout attitude active', (done) => {
    aden({ dev: true, attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub/additional.html')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/id="wrapper"/ig);
            an.shutdown(done);
          });
      });
  });

  she('works with layout inactive for md (nolayout)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/nolayout'))
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

  she('includes images in the build', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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

  she('includes images required from sub path in the build', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/images/test2.png')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      });
  });

  she('includes images from sub path in the build', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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

  she('injects commons (layout inactive)', (done) => {
    aden({ dev: true, attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/commons.js/ig);
            an.shutdown(done);
          });
      });
  });

  she('injects commons (nolayout)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/nolayout/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/commons.js/ig);
            an.shutdown(done);
          });
      });
  });
});
