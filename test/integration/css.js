const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('CSS Extension', () => {
  she('does not inject global.js without a base.css', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toNotMatch(/<script type="text\/javascript" src="\/global\.js">/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('injects global.js with at least something like a base.css', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<script type="text\/javascript" src="\/global\.js">/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
