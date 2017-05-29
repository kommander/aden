const fs = require('fs');
const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');
const Logger = require('../../../lib/aden.logger');
const TestDuplex = require('../../lib/test-duplex.js');

describe('Layout Attitude', () => {
  she('recognises changes in a layout file and reloads it', (done) => {
    const stream = new TestDuplex();
    stream.on('data', (data) => console.log(data.toString('utf8')));
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

    adn.init(path.resolve(__dirname, '../../tmpdata/layoutdev'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) {
              done(err);
              return;
            }
            expect(res.status).toMatch(200);
            expect(res.text).toMatch(/<div><p>content<\/p>\n<\/div>/);

            logParser.on('dev:rebuild:done', () => {
              request(an.app)
                .get('/')
                // fckn hell. todo: use promisified supertest
                .end((err2, res2) => {
                  if (err2) {
                    done(err2);
                    return;
                  }

                  expect(res2.text).toMatch(/<div>footer<\/div>/);

                  an.shutdown();
                });
            });

            setTimeout(() => fs.writeFileSync(
              path.resolve(__dirname, '../../tmpdata/layoutdev/layout.default.html'),
              '<div>{{body}}</div><div>footer</footer>'
            ), 300);
          });
      });
  });
});
