// This is what the CLI automates for you
const aden = require('../lib/aden')
const { ENTRY_STATIC } = aden.Constants
const adn = aden({ dev: true, logger: { silent: false } })

const behaviour = adn.createAttitude('md-html')

behaviour.registerFiles('entry', /\.html$/, {
  entry: ENTRY_STATIC
})

adn.init(__dirname)
  .then((an) => an.run('dev'))
  .then((an) => an.listen(7654))
