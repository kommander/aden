'use strict'

const rimraf = require('rimraf')
const { promisify } = require('util')
const fs = require('fs')
const writeFile = promisify(fs.writeFile)
const path = require('path')
const _ = require('lodash')
const mkdirp = require('mkdirp')

const {
  KEY_APATH,
  KEY_CUSTOM,
  KEY_FILE_ARRAY
} = require('./aden.constants')

async function build (pages) {
  this.log.info('Building Aden app')

  await this.applyHook('pre:build', { pages })
  await new Promise((resolve, reject) =>
    mkdirp(this.settings.dist, (err) => (err ? reject(err) : resolve()))
  )

  await this.walkPages(pages, (page) => {
    Promise.resolve().then(() => {
      // Backend build
      const keys = page.keys.map((key) => {
        if (typeof key.build === 'function' && key.value) {
          return key.build(page, key)
        }
        return null
      })
      .filter((key) => !!key)
      return Promise.all(keys)
        .then(() => page)
    })
  })

  await this.writePageStats(pages)
  await this.applyHook('post:build', { pages })
}

const dropKeyProperties = [
  'resolved', 'dir', 'dist', 'default',
  'cache', 'load'
]

function serializer (pages) {
  return this.flattenPages(pages)
    .map((page) =>
      Object.assign(_.omit(page, [
        'ignore', 'noWatch',
        'log', 'activeAttitudes', 'fileHandlers', 'handledFiles',
        'assign', 'set', 'has',
        'webpackStatsDist', 'pageStatsDist', 'dist',
        'entry', 'greedy', 'key'
      ]), {
        children: page.children.map((child) => child.id),
        keys: page.keys
          .filter((key) => key.store)
          .map((key) => {
            if (key.type === KEY_FILE_ARRAY) {
              Object.assign(key, {
                value: key.value.map((file) => _.omit(file, dropKeyProperties))
              })
            }

            if (key.type === KEY_CUSTOM) {
              Object.assign(key, {
                value: typeof key.serialize === 'function'
                  ? key.serialize(key.value)
                  : {}
              })
            }

            if (key.type === KEY_APATH) {
              Object.assign(key, {
                value: null
              })
            }

            return _.omit(key, dropKeyProperties)
          })
      })
    )
}

function serializePages (pages) {
  return Promise.resolve().then(() => {
    const serials = this.serializer(pages)
    const result = {
      pages: serials,
      info: {
        registered: pages.map((page) => page.id),
        rootPage: pages[0].id
      }
    }
    return JSON.stringify(result)
  })
}

async function writePageStats (pages) {
  if (!this.isDEV) {
    this.log.start('Writing page stats to dist.')

    const filePath = path.resolve(this.settings.dist, this.settings.pageStatsDist)

    const pagesJson = await this.serializePages(pages)
    this.log.debug('Writing page stats file', { filePath, pagesJson })
    await writeFile(
      filePath,
      pagesJson
    )
    this.log.success('Wrote page stats to dist.', {
      pagesJson
    })
  }
  return pages
}

// Clear dist folders
function clean (/* pages */) {
  return new Promise((resolve, reject) => {
    // TODO: use util.promisify
    rimraf(this.settings.dist, (rmErr) => {
      if (rmErr) {
        reject(rmErr)
        return
      }
      resolve()
    })
  })
}

module.exports = {
  build,
  clean,
  writePageStats,
  serializePages,
  serializer
}
