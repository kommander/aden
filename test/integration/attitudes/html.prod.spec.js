const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('HTML Prod', () => {
  she('has a root route with index.html entry point', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(200, () => {
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('delivers index.html at root path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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

  she('delivers index.html at sub path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
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

  she('injects common.js into existing html', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/html'))
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
});
