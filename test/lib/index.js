const rimraf = require('rimraf')
const path = require('path')
const ncp = require('ncp').ncp
ncp.limit = 8

const dataPath = path.resolve(__dirname, '../data')
const tmpdataPath = path.resolve(__dirname, '../tmpdata')

function setup () {
  if (process.__TEST__) {
    console.log('only call test setup once per process')
    process.exit(1)
  }
  process.__TEST__ = true

  return Promise.resolve().then(() => new Promise((resolve) => {
    // Clean test data
    rimraf(tmpdataPath, (err) => {
      if (err) {
        console.log('Could not clean tmp test data', err)
        process.exit(1)
      }
      resolve()
    })
  }))
  .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
  .then(() => new Promise((resolve) => {
    // Copy test data
    ncp(dataPath, tmpdataPath, (err) => {
      if (err) {
        console.log('Could not setup tmp test data', err)
        process.exit(1)
      }
      resolve()
    })
  }))
  .then(() => new Promise((resolve) => setTimeout(resolve, 1000)))
}

module.exports = {
  setup
}
