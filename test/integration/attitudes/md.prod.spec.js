const aden = require('../../../lib/aden')
const path = require('path')
const request = require('supertest')
const expect = require('expect')

describe.skip('MD Markdown Attitude Prod', () => {
  she('has a root route with index.md entry point', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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

  she('delivers index.md at root path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/Hello marked/ig)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers index.md at sub path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/Sub Page/ig)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers additional md files at page path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/another.html')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/Just a file/ig)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers additional md files at page sub path', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub/additional.html')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/yet another page/ig)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  // +ext: hbs|handlebars|mustache|md|markdown
  she('wraps md in given layout (layout.default.html)', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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
      .catch(done)
  })

  she('works without layout attitude active', (done) => {
    aden({ attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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

  she('works for additionals without layout attitude active', (done) => {
    aden({ attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        request(an.app)
          .get('/sub/additional.html')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toNotMatch(/id="wrapper"/ig)
            an.shutdown(done)
          })
      })
  })
  she('includes images in the build', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
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
      .catch(done)
  })

  she('includes images required from sub path in the build', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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
      .catch(done)
  })

  she('includes images from sub path in the build', (done) => {
    aden()
      .init(path.resolve(__dirname, '../../tmpdata/md'))
      .then((an) => an.run('build'))
      .then((an) => an.run('production'))
      .then((an) => {
        // resolve sub-test.png
        const stats = an.webpackStats[0].children.find((child) => (child.name === 'frontend'))
        const fileName = stats.assets
          .filter((asset) => asset.name.match(/^images/))[1].name
        request(an.app)
          .get(`/${fileName}`)
          .end((err, res) => {
            if (err) done(err)
            expect(res.status).toMatch(200)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('injects commons (nolayout)', (done) => {
    aden({ attitudes: ['!layout'] })
      .init(path.resolve(__dirname, '../../tmpdata/md'))
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
})
