const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Basics Dev', () => {
  she('injects common.js into existing html', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/html'))
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
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/custom'))
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
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/500')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom Error/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses custom status pages (404)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('dev'))
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
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/custom'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/provoke')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/Custom Error/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('// Things Aden already does but are untested...');
  she('ignores dot files/folders for page parsing');
  she('does not expose bare assets from page tree');
});
