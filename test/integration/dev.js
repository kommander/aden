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

  she('recognises new files in sub folders and sets up the page', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/dev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.status).toMatch(404);

            fs.writeFileSync(
              path.resolve(__dirname, '../tmpdata/dev/sub', 'index.html'),
              '<tag>sub content</tag>'
            );

            // Mhhh... need to know when a build has finished
            an.on('dev:reload:done', () => {
              request(an.app)
                .get('/sub')
                // fckn hell. todo: use promisified supertest
                .end((err2, res2) => {
                  if (err2) {
                    done(err2);
                    return;
                  }

                  expect(res2.text).toMatch(/<tag>sub content<\/tag>/ig);

                  an.shutdown(done);
                });
            });
          });
      });
  });

  she('recognises changed watch keys', (done) => {
    aden().init(path.resolve(__dirname, '../tmpdata/dev2'))
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
              path.resolve(__dirname, '../tmpdata/dev2', '.get.js'),
              'module.exports=()=>(req, res)=>{res.send("success")};'
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

                  expect(res2.text).toMatch('success');

                  an.shutdown(done);
                });
            });
          });
      });
  });
});
