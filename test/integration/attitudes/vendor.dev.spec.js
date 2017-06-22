const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Vendor Attitude', () => {
  she('puts specified modules into vendor bundle', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/vendor'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/v-vendor.js')
          .expect(200, (err, res) => {
            expect(res.text).toMatch(/teststring/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
