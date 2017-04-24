const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('MD Markdown Extension', () => {
  she('has a root route with index.md entry point', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/md'))
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
    aden().init(path.resolve(__dirname, '../tmpdata/md'))
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

  she('delivers index.html at sub path', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/md'))
      .then((an) => an.run('dev'))
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
});
