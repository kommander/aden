// Aden Backend Application
const Aden = require('./aden');
const path = require('path');

function bootstrap(app, logger, config) {
  const aden = new Aden(app, logger, config);
  const promises = [aden.init()];

  // TODO: Use program.option to switch dev app on/off
  // TODO: !!! Spawn devapp with aden.focus(path, route)...
  // !!! (always only have one aden instance per app) !!!
  // Set up the dev app with a new express app instance
  // OR GET RID OF THE DEV APP FOR NOW
  if (process.env.NODE_ENV === 'development') {
    const devAden = new Aden(app, logger, {
      path: path.resolve(__dirname, '../devapp'),
      basePath: '/aden',
      allowProgramOptions: false,
      silent: true,
    });

    const adenLink = '<a href="/aden" style="display:block;position:fixed;bottom:0;right:0;background-color:#aaa;">Aden</a>'; // eslint-disable-line

    aden.hook('post:render', (serve) => {
      serve.html += adenLink; // eslint-disable-line
    });

    devAden.hook('post:render', (serve) => {
      if (serve.page.name === '404') {
        serve.html += adenLink; // eslint-disable-line
      }
    });

    promises.push(devAden.init());
  }

  return Promise.all(promises);
}

module.exports = bootstrap;
