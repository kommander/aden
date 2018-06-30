const aden = require('../../lib/aden')
const path = require('path')
const expect = require('expect')

describe('Page Dev', () => {
  she('throws an error when a registered page is not accessible', (done) => {
    const adn = aden({
      dev: true
    })

    adn.init(path.resolve(__dirname, '../tmpdata/not-a-page-path-cdefg'))
      .then((an) => an.run('dev'))
      .catch((err) => {
        expect(err.reason).toEqual('ENOENT')
        adn.shutdown(done)
      })
  })
})
