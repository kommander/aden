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

  she('handles custom config keys', (done) => {
    aden({ dev: true })
      .registerKey('testkey2', {
        type: 'custom',
        config: true,
      })
      .init(path.resolve(__dirname, '../tmpdata/config'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('testkey2');
        expect(an.rootPage.key.testkey2.value).toEqual({ a: 'b' });
        an.shutdown(done);
      })
      .catch(done);
  });

  she('does not include unregistered keys from config', (done) => {
    aden({ dev: true })
      .registerKey('testkey2', {
        type: 'custom',
        config: true,
      })
      .init(path.resolve(__dirname, '../tmpdata/config'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toNotIncludeKey('testkey');
        expect(an.rootPage.key).toIncludeKey('testkey2');
        expect(an.rootPage.key.testkey2.value).toEqual({ a: 'b' });
        an.shutdown(done);
      })
      .catch(done);
  });

  she('resolves rpath config keys', (done) => {
    aden({ dev: true })
      .registerKey('testkey3', {
        type: 'rpath',
        config: true,
      })
      .init(path.resolve(__dirname, '../tmpdata/config'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('testkey3');
        expect(path.isAbsolute(an.rootPage.key.testkey3.resolved)).toBe(true);
        an.shutdown(done);
      })
      .catch(done);
  });
});
