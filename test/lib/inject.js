const lib = require('./');

before((done) => {
  lib.setup().then(() => done());
});
