const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('HBS', () => {
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
            expect(res.text).toMatch(/^<!DOCTYPE html>/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
