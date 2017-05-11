const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Controller Dev', () => {
  she('uses .get.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-get/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .post.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .post('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-post/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .put.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .put('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-put/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .delete.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .delete('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-delete/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .all.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => new Promise((resolve, reject) => {
        request(an.app)
          .delete('/alltest')
          .end((err, res) => {
            if (err) reject(err);
            expect(res.text).toMatch(/^alltest-all/);
            resolve(an);
          });
      }))
      .then((an) => new Promise((resolve, reject) => {
        request(an.app)
          .get('/alltest')
          .end((err, res) => {
            if (err) reject(err);
            expect(res.text).toMatch(/^alltest-all/);
            resolve(an);
          });
      }))
      .then((an) => an.shutdown(done))
      .catch(done);
  });
});
