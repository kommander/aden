const aden = require('../../../lib/aden');
const path = require('path');
const request = require('supertest');
const expect = require('expect');

describe('CSS Attitude Prod', () => {
  she('puts common requires/imports into common css');

  she('includes page css (hashed name)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        // The hashed version of the filename for production
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'));
        const fileName = stats.assetsByChunkName[`sub${path.sep}bundle`][1];
        request(an.server)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/\.anotherTestClass/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she.skip('includes page scss (hashed name)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        // The hashed version of the filename for production
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'));
        const fileName = stats.assetsByChunkName[`sub2${path.sep}bundle`][1];
        request(an.server)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err);
            expect(res.text).toMatch(/\.scssTestClass/ig);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('takes care of images', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/cssbase'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'));
        const fileName = stats.assets
          .filter((asset) => asset.name.match(/^images/))[0].name;
        request(an.server)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toMatch(200);
            an.shutdown(done);
          });
      })
      .catch(done);
  });
});
