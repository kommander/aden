const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('Webpack Dev', () => {
  she('merges a webpack config from a page .server config', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/merge'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.webpackConfigs[0].resolve).toIncludeKey('alias');
        expect(an.webpackConfigs[0].resolve.alias).toIncludeKey('$');
        an.shutdown(done);
      })
      .catch(done);
  });
});
