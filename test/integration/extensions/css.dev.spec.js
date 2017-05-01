const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('CSS Extension Dev', () => {
  she('puts common requires/imports into common css');

  she('includes page css', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/cssbase.sub.css')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/\.anotherTestClass/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('includes page scss', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/cssbase.sub2.css')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/\.scssTestClass/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('takes care of images', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/images/test.png')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
