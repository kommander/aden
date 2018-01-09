'use strict'

const rimraf = require('rimraf')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const mkdirp = require('mkdirp')

const {
  KEY_APATH,
  KEY_CUSTOM,
  KEY_FILE_ARRAY
} = require('./aden.constants')

async function build (pages, webpackConfigs) {
  this.log.info('Building Aden app')

  await this.applyHook('pre:build', { pages, webpackConfigs })
  await new Promise((resolve, reject) =>
    mkdirp(this.settings.dist, (err) => (err ? reject(err) : resolve()))
  )

  let stats = null
  try {
    stats = await this.compile(webpackConfigs)
  } catch (ex) {
    if (this.isDEV) {
      this.log.error('Webpack failed. Waiting for changes...', ex)
    } else {
      throw ex
    }
  }

  if (!this.isDEV) {
    await this.writeWebpackStats(pages, stats)
  }

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
  await this.applyHook('post:build', { pages, webpackConfigs })
}

const dropKeyProperties = [
  'resolved', 'dir', 'dist', 'default', 'htmlPlugin',
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

function writePageStats (pages) {
  if (!this.isDEV) {
    this.log.start('Writing page stats to dist.')

    const filePath = path.resolve(this.settings.dist, this.settings.pageStatsDist)

    return this.serializePages(pages)
      .then((pagesJson) => new Promise((resolve, reject) =>
        fs.writeFile(
          filePath,
          pagesJson,
          (err) => {
            if (err) {
              reject(err)
              return
            }
            this.log.success('Wrote page stats to dist.', {
              pagesJson
            })
            resolve()
          })
        )
      )
  }
  return pages
}

function writeWebpackStats (pages, stats) {
  this.log.start('Writing webpack stats to dist.')

  const jsonStats = stats
    .map((stat) => JSON.stringify(stat.toJson()))
    .join(',')

  return new Promise((resolve, reject) =>
    fs.writeFile(
      path.resolve(this.settings.dist, this.settings.webpackStatsDist),
      `[${jsonStats}]`,
      (err) => {
        if (err) {
          reject(err)
          return
        }
        this.log.success('Wrote webpack stats to dist.')
        resolve(stats)
      }
    )
  )
}

// Clear dist folders
function clean (/* pages */) {
  return new Promise((resolve, reject) => {
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
  writeWebpackStats,
  writePageStats,
  serializePages,
  serializer
}
