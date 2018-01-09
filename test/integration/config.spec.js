const aden = require('../../lib/aden')
const Attitude = require('../../lib/aden.attitude')
const path = require('path')
const expect = require('expect')

describe('Config', () => {
  she('handles string config keys', (done) => {
    const adn = aden({ dev: true })

    adn.hook('init:page', ({ page }) => {
      const att = new Attitude(adn, 'custom-att')
      att.registerKey('testkey', {
        type: 'string',
        config: true
      })
      att.applyTo(page)
    })
    .init(path.resolve(__dirname, '../tmpdata/config'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(an.rootPage).toIncludeKey('testkey')
      expect(an.rootPage.testkey.value).toEqual('testvalue')
      an.shutdown(done)
    })
    .catch(done)
  })

  she('handles custom config keys', (done) => {
    const adn = aden({ dev: true })

    adn.hook('init:page', ({ page }) => {
      const att = new Attitude(adn, 'custom-att')
      att.registerKey('testkey2', {
        type: 'custom',
        config: true
      })
      att.applyTo(page)
    })
    .init(path.resolve(__dirname, '../tmpdata/config'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(an.rootPage).toIncludeKey('testkey2')
      expect(an.rootPage.testkey2.value).toEqual({ a: 'b' })
      an.shutdown(done)
    })
    .catch(done)
  })

  she('does not include unregistered keys from config', (done) => {
    const adn = aden({ dev: true })
    adn.hook('init:page', ({ page }) => {
      const att = new Attitude(adn, 'custom-att')
      att.registerKey('testkey2', {
        type: 'custom',
        config: true
      })
      att.applyTo(page)
    })
    .init(path.resolve(__dirname, '../tmpdata/config'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(an.rootPage).toNotIncludeKey('testkey')
      expect(an.rootPage).toIncludeKey('testkey2')
      expect(an.rootPage.testkey2.value).toEqual({ a: 'b' })
      an.shutdown(done)
    })
    .catch(done)
  })

  she('resolves rpath config keys', (done) => {
    const adn = aden({ dev: true })
    adn.hook('init:page', ({ page }) => {
      const att = new Attitude(adn, 'custom-att')
      att.registerKey('testkey3', {
        type: 'rpath',
        config: true
      })
      att.applyTo(page)
    })
    .init(path.resolve(__dirname, '../tmpdata/config'))
    .then((an) => an.run('dev'))
    .then((an) => {
      expect(an.rootPage).toIncludeKey('testkey3')
      expect(path.isAbsolute(an.rootPage.testkey3.resolved)).toBe(true)
      an.shutdown(done)
    })
    .catch(done)
  })
})
