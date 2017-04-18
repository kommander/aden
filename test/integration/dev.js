const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('dev', () => {
  she('recognises new files and sets up the page', (done) => {
    aden().init(path.resolve(__dirname, '../data/dev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(404);
            an.shutdown(done);
          });
      });
  });
});
