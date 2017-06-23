const { async, await } = require('asyncawait');
const aden = require('../../lib/aden');
const { ENTRY_STATIC } = aden.Constants;
const Attitude = aden.Attitude;
const adn = aden({ dev: true, logger: { silent: false }});

const behaviour = new Attitude(adn, 'md-html');

behaviour.registerFiles('entry', /\.html$/, {
  entry: ENTRY_STATIC,
});

(async () => {
  try {
    await adn.init(__dirname);
    await adn.run('dev');
    await adn.listen(7654);
  } catch(err) {
    adn.log.error('Server failed, because of', err);
    adn.shutdownAndExit(1);
  };
})();
