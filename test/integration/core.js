const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');

describe('Aden Live', () => {
  she('has no root route without an entry', (done) => {
    aden()
      .init(path.resolve(__dirname, '../data/empty'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(404, () => {
            an.shutdown(done);
          });
      });
  });
});
