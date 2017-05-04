const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');

describe('Attitudes API', () => {
  she('allows to load app level attitudes', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/attitudes'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.rootPage.key).toIncludeKey('customAttitudeKey');
        an.shutdown(done);
      })
      .catch(done);
  });
});
