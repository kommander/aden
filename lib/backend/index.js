// Aden Backend Application
const Aden = require('./aden');

function bootstrap(app, logger, config) {
  const aden = new Aden(app, logger, config);
  return aden.init();
}

module.exports = bootstrap;
