const fs = require('fs');
const aden = require('../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');
const rimraf = require('rimraf');
const Logger = require('../../lib/aden.logger');
const TestDuplex = require('../lib/test-duplex.js');

describe('dev', () => {
  she('recognises new files and sets up the page', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    adn.init(path.resolve(__dirname, '../tmpdata/dev'))
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


            // Mhhh... need to know when a build has finished
            logParser.on('dev:reload:done', () => {
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

            setTimeout(() => fs.writeFileSync(
              path.resolve(__dirname, '../tmpdata/dev', 'index.html'),
              '<tag>content</tag>'
            ), 300);
          });
      });
  });

  she('recognises new files in sub folders and sets up the page', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    adn.init(path.resolve(__dirname, '../tmpdata/dev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub/')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.status).toMatch(404);

            // Mhhh... need to know when a build has finished
            logParser.on('dev:reload:done', () => {
              request(an.app)
                .get('/sub/')
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

            setTimeout(() => fs.writeFileSync(
              path.resolve(__dirname, '../tmpdata/dev/sub', 'index.html'),
              '<tag>sub content</tag>'
            ), 300);
          });
      });
  });

  she('recognises deleted folders and removes the page', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    adn.init(path.resolve(__dirname, '../tmpdata/devunlink'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/sub/')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.status).toMatch(200);

            // Mhhh... need to know when a build has finished
            logParser.on('dev:reload:done', () => {
              request(an.app)
                .get('/sub/')
                // fckn hell. todo: use promisified supertest
                .end((err2, res2) => {
                  if (err2) {
                    done(err2);
                    return;
                  }

                  expect(res2.status).toMatch(404);

                  an.shutdown(done);
                });
            });

            setTimeout(() => rimraf.sync(
              path.resolve(__dirname, '../tmpdata/devunlink/sub')
            ), 300);
          });
      });
  });

  she('recognises changed watch keys', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    adn.init(path.resolve(__dirname, '../tmpdata/dev2'))
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

            // Mhhh... need to know when a build has finished
            logParser.on('dev:reload:done', () => {
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

            setTimeout(() => fs.writeFileSync(
              path.resolve(__dirname, '../tmpdata/dev2', '.get.js'),
              'module.exports=()=>(req, res)=>{res.send("success")};'
            ), 300);
          });
      });
  });
});
