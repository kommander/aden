const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Copy Dev', () => {
  she('moves selected files to .dist/public', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/copy'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/file-to-copy.json')
          .expect(200, (err, res) => {
            expect(res.text).toMatch(/"key": "data"/)
            an.shutdown();
            done(err)
          });
      })
      .catch(done);
  });

  she('does not move non-selected files to .dist/public', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/copy'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/dont-copy.json')
          .expect(404, (err, res) => {
            expect(res.text).toMatch(/Could not find what/)
            an.shutdown();
            done(err)
          });
      })
      .catch(done);
  });
});
