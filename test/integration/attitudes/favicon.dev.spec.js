const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');

describe.skip('Favicon Dev', () => {
  she('delivers favicon from root', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/favicon'))
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
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/favicon/sub'))
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
