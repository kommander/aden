const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('page keys (registerKey)', () => {
  she('adds a named key to the page', (done) => {
    aden()
      .registerKey('testKey', {
        value: 'test',
      })
      .init(path.resolve(__dirname, '../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('testKey');
        an.shutdown(done);
      })
      .catch(done);
  });
});
