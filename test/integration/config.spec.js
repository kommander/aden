const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('Config', () => {
  she('handles string config keys', (done) => {
    aden({ dev: true })
      .registerKey('testkey', {
        type: 'string',
        config: true,
      })
      .init(path.resolve(__dirname, '../tmpdata/config'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('testkey');
        expect(an.rootPage.key.testkey.value).toEqual('testvalue');
        an.shutdown(done);
      })
      .catch(done);
  });
});
