const aden = require('../../../lib/aden')
const path = require('path')
const request = require('supertest')
const expect = require('expect')

describe('HTML Dev', () => {
  she('has a root route with index.html entry point', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/')
          .expect(200, () => {
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers index.html at root path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/^<!DOCTYPE html>/)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('delivers index.html at sub path', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/sub/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/^<!DOCTYPE html>/)
            an.shutdown(done)
          })
      })
      .catch(done)
  })

  she('injects common.js into existing html', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../../tmpdata/html'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/')
          .end((err, res) => {
            if (err) done(err)
            expect(res.text).toMatch(/<script type="text\/javascript" src="\/commons\.js">/ig)
            an.shutdown(done)
          })
      })
      .catch(done)
  })
})
