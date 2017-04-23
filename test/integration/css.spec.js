const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('CSS Extension', () => {
  she('puts base.css into commons', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/commons.css')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/\.aTestClass/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('includes page css', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/cssbase'))
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
});
