// Aden Backend Application
const Aden = require('./aden');

function bootstrap(app, config) {
  const aden = new Aden(app, config);
  return aden.init();
}

module.exports = bootstrap;
