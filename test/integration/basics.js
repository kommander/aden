const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('Basics', () => {
  she('injects common.js into existing html', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/<script type="text\/javascript" src="\/commons\.js">/ig);
            an.shutdown(done);
          });
      });
  });
});
