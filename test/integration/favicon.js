const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');

describe('Favicon', () => {
  she('delivers favicon from root', (done) => {
    aden().init(path.resolve(__dirname, '../data/favicon'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/favicon.ico')
          .expect(200, (err) => {
            if (err) {
              done(err);
              return;
            }
            an.shutdown(done);
          });
      });
  });

  she('does not deliver favicon if there is none', (done) => {
    aden().init(path.resolve(__dirname, '../data/favicon/sub'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/favicon.ico')
          .expect(404, (err) => {
            if (err) {
              done(err);
              return;
            }
            an.shutdown(done);
          });
      });
  });
});
