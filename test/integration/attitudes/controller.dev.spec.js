const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');
const TestDuplex = require('../../lib/test-duplex.js');
const Logger = require('../../../lib/aden.logger');
const fs = require('fs');

describe('Controller Dev', () => {
  she('uses .get.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-get/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .post.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .post('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-post/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .put.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .put('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-put/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .delete.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .delete('/')
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/^controller-delete/);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('uses .all.js as controller', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/controller'))
      .then((an) => an.run('dev'))
      .then((an) => new Promise((resolve, reject) => {
        request(an.app)
          .delete('/alltest/')
          .end((err, res) => {
            if (err) reject(err);
            expect(res.text).toMatch(/^alltest-all/);
            resolve(an);
          });
      }))
      .then((an) => an.shutdown(done))
      .catch(done);
  });

  she('recognises changed .get files and reloads them', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    stream.on('data', (data) => {
      console.log(data.toString('utf8'));
    })

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    adn.init(path.resolve(__dirname, '../../tmpdata/getreload'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.text).toMatch(/testdata/);

            logParser.once('dev:reload:done', () => {
              request(an.app)
                .get('/')
                .end((err2, res2) => {
                  if (err2) {
                    done(err2);
                    return;
                  }

                  expect(res2.text).toMatch(/something else/ig);

                  an.shutdown(done);
                });
            });

            setTimeout(() => fs.writeFileSync(
              path.resolve(__dirname, '../../tmpdata/getreload', '.get.js'),
              'module.exports = () => (req, res) => {res.send(\'something else\')}'
            ), 300);
          });
      });
  });
});
