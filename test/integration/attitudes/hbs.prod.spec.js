const aden = require('../../../lib/aden')
const path = require('path')
const request = require('supertest')
const expect = require('expect')

describe.skip('HBS Prod', () => {
  she('has a root route with index.hbs entry point', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .expect(200, () => {
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers index.hbs at root path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/^<!DOCTYPE html>/)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers index.hbs at sub path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/^subsub/)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('wraps hbs in given layout (layout.default.html|hbs|md)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/id="wrapper"/ig)
            an.shutdown(done)
          })
      })
  })

  she('works without layout attitude active (hbs)', (done) => {
    aden({ attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toNotMatch(/id="wrapper"/ig)
            an.shutdown(done)
          })
      })
  })

  she('works with layout inactive for hbs (nolayout)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs/nolayout'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toNotMatch(/id="wrapper"/ig)
            an.shutdown(done)
          })
      })
  })

  she('includes images in the build (hbs)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        // In production images use a hash only name,
        // where images with same content become the same resource
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'))
        const fileName = stats.assets
          .filter((asset) => asset.name.match(/^images/))[0].name
        request(an.app)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err)
            expect(res.status).toMatch(200)
            an.shutdown(done)
          })
      })
  })

  she('includes images required from sub path in the build (hbs)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        // In production images use a hash only name,
        // where images with same content become the same resource
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'))
        const fileName = stats.assets
          .filter((asset) => asset.name.match(/^images/))[0].name
        request(an.app)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err)
            expect(res.status).toMatch(200)
            an.shutdown(done)
          })
      })
  })

  she('injects commons in hbs (layout inactive)', (done) => {
    aden({ attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/wrap/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/commons.js/ig)
            an.shutdown(done)
          })
      })
  })

  she('injects commons in hbs (nolayout)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/hbs'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/nolayout/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/commons.js/ig)
            an.shutdown(done)
          })
      })
  })
})
