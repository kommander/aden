const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe.skip('Statuspages Dev', () => {
  she('does not route custom status pages (404)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('dev'))
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

  she('routes custom status pages (error)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('dev'))
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
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
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
      .init(path.resolve(__dirname, '../../tmpdata/custom'))
      .then((an) => an.run('dev'))
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

  she('has a default status page (404)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom/defaults'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<b>Could not find what you were looking for\.<\/b>/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('has a default status page (500)', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom/provoke'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<b>Something went wrong\.<\/b>/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('takes core error route if no default is given', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/custom/nodefaults'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<pre>Error:/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
