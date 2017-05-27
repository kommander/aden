const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Statuspages Prod', () => {
  she('does not route custom status pages (404)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/404/')
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
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/500/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses custom status pages (404)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/not_a_page_in_path')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom 404/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses custom status pages (error)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/provoke/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom Error/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
