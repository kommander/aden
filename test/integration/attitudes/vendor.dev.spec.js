const aden = require('../../../lib/aden')
const path = require('path')
const request = require('supertest')
const expect = require('expect')

describe('Vendor Attitude', () => {
  she('puts specified modules into vendor bundle', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/vendor'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/v_vendor.js')
          .expect(200, (err, res) => {
            expect(res.text).toMatch(/teststring/)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('does not include the same assets twice', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/vendor2'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.pages[0].assets.value.length).toBe(1)
        an.shutdown(done)
      })
      .catch(done)
  })

  she('throws vendor compiler errors', (done) => {
    const adn = aden({ dev: true })
    adn
      .init(path.resolve(__dirname, '../../tmpdata/vendorerror'))
      .then((an) => an.run('dev'))
      .catch((err) => {
        expect(err.message).toMatch(/Module not found/)
        adn.shutdown(done)
      })
  })

  she('can take multiple named vendor specs', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/vendor3'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/ven1.js')
          .expect(200, (err, res) => {
            expect(res.text).toMatch(/teststring1/)
            request(an.server)
              .get('/ven2.js')
              .expect(200, (err, res) => {
                expect(res.text).toMatch(/teststring2/)
                an.shutdown(done)
              })
          })
      })
      .catch(done)
  })
})
