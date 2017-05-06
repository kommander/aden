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

  she('// Things Aden already does but are untested...');
  she('calls a build hook for keys marked as build');
  she('resolves dist and distFileName for keys marked as build');
  she('resolves dist and distFileName for file array keys marked as build');
  she('ignores dot files/folders for page parsing');
  she('does not expose bare assets from page tree');
});
