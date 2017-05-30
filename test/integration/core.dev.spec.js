const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('Core Dev', () => {
  she('provides a startup callback', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.has('startupKey')).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('exposes aden.server in startup callback', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('calls startup hooks for subpages');

  // (static entry point templates got into public build)
  she('distincts between static and dynamic entry points');

  // docs/quotemachine/api/quote/quote.js
  she('clears the cache for changed modules used by controllers');

  she('does not try to load invalid .server files multiple times until it is changed');

  she('// Things Aden already does but are untested...');
  she('takes ignores from .server, applied to subpath only');
  she('calls a build hook for keys marked as build');
  she('resolves dist and distFileName for keys marked as build');
  she('resolves dist and distFileName for file array keys marked as build');
  she('ignores dot files/folders for page parsing');
  she('does not expose bare assets from page tree');
});
