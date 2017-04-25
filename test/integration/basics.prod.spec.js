const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Basics Prod', () => {
  she('injects common.js into existing html', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/html'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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

  she('does not route custom status pages (404)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/404')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('does not route custom status pages (error)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/custom2'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/error')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
