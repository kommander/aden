const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('JS Extension Dev', () => {
  she('includes page js', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/js'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/js.js')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/testFn/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('// Things Aden already does but are untested...');
  she('puts common requires/imports into common js');
});
