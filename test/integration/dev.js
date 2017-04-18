const fs = require('fs');
const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('dev', () => {
  she('has no root route without an entry', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/empty'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(404, () => {
            an.shutdown(done);
          });
      });
  });

  she('recognises new files and sets up the page', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/dev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.status).toMatch(404);

            fs.writeFileSync(
              path.resolve(__dirname, '../tmpdata/dev', 'index.html'),
              '<tag>content</tag>'
            );

            // Mhhh... need to know when a build has finished
            an.on('dev:reload:done', () => {
              request(an.app)
                .get('/')
                // fckn hell. todo: use promisified supertest
                .end((err2, res2) => {
                  if (err2) {
                    done(err2);
                    return;
                  }

                  expect(res2.text).toMatch(/<tag>content<\/tag>/ig);

                  an.shutdown(done);
                });
            });
          });
      });
  });
});
