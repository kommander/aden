const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Basics Dev', () => {
  she('injects common.js into existing html', (done) => {
    aden({ dev: true }).init(path.resolve(__dirname, '../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<script type="text\/javascript" src="\/commons\.js">/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('routes custom status pages (404)', (done) => {
    aden({ dev: true }).init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/404')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom 404/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('routes custom status pages (error)', (done) => {
    aden({ dev: true }).init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/error')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom Error/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
