const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('Webpack Dev', () => {
  she('merges a webpack config from a page .server config', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/merge'))
      .then((an) => an.run('dev'))
      .then((an) => {
        const frontendConfig = an.webpackConfigs
          .find((conf) => (conf.name === 'frontend'));

        expect(frontendConfig.resolve).toIncludeKey('alias');
        expect(frontendConfig.resolve.alias).toIncludeKey('$');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('takes additional webpack entry files and adds them to the the entry array', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/webpack/addentry'))
      .then((an) => an.run('dev'))
      .then((an) => {
        const frontendConfig = an.webpackConfigs
          .find((conf) => (conf.name === 'frontend'));

        expect(frontendConfig.entry['addentry']).toInclude('./add_entry.js');
        expect(frontendConfig.entry['addentry.subentry']).toInclude('./sub_entry.js');

        an.shutdown(done);
      })
      .catch(done);
  });
});
