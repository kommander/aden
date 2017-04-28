const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('MD Markdown Extension Prod', () => {
  she('has a root route with index.md entry point', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(200, () => {
            an.shutdown(done);
          });
      });
  });

  she('delivers index.md at root path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Sub Page/ig);
            an.shutdown(done);
          });
      });
  });

  she('delivers additional md files at page path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/another.md')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Just a file/ig);
            an.shutdown(done);
          });
      });
  });

  she('delivers additional md files at page sub path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub/additional.md')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/yet another page/ig);
            an.shutdown(done);
          });
      });
  });

  she('wraps md in given layout (layout.default.html|hbs|md)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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

  she('includes images in the build', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        const fileName = an.webpackStats[0].assets
          .filter((asset) => asset.name.match(/^images/))[0].name;
        request(an.app)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      });
  });
});
