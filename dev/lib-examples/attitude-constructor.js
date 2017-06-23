const aden = require('../../lib/aden');
const Attitude = aden.Attitude;
const { ENTRY_STATIC } = aden.Constants;
const adn = aden({ dev: true, logger: { silent: false }});

const attitude = new Attitude(adn, 'md-html');

attitude.registerFiles('myKey', /\.html$/, {
  entry: ENTRY_STATIC,
});

attitude.hook('build', ({ page }) => {
  await suuperHandle(page.myKey.value);
});

attitude.hook('setup', ({ page }) => {
  await suuperSetup(page.myKey.value);
});

attitude.hook('init', () => {});

adn.init(__dirname)
  .then(() => adn.run('dev'))
  .then(() => adn.listen(7654))
  .catch((err) => {
    adn.log.error('Server failed, because of', err);
    adn.shutdownAndExit(1);
  });

