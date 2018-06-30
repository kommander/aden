'use strict'

const cannot = require('brokens')
const path = require('path')
const chokidar = require('chokidar')

function devWatch (rootPath) {
  this.watcher = chokidar.watch(rootPath, {
    recursive: true,
    persistent: true,
    depth: 10,
    ignored: /node_modules|\.dist/,
    ignoreInitial: true,
    awaitWriteFinish: true
  })

  this.watcher.on('all', this.devWatchListenerBound)

  this.watcher.on('error', (err) => this.log.error('FSWatcher', err))
}

function devWatchListener (event, filePath) {
  const filename = path.relative(this.rootPath, filePath)

  // TODO: Get the page for the path and apply filters and options in page scope (?)
  const filterMatches = this.rootPage.noWatch.filter((value) => filename.match(value))
  if (filterMatches.length !== 0 || this.shutdownInProgress) {
    return
  }

  clearTimeout(this.devWatchTimeout)

  this.log.info(`App path changed at ${filename} (${event})`)

  // Needs to be on _this_ bc. of the timeout that could put a non-rename in between,
  // then the re-build would ignore the rename event
  this.wasRenameEvent = this.wasRenameEvent ||
    event === 'rename' ||
    event === 'delete' ||
    event === 'add' ||
    event === 'unlink' ||
    event === 'unlinkDir' ||
    this.settings.dotFile.includes(filename)

  this.wasCustomFileEvent = this.watchKeys
    .find((key) => (key.value === filename))

  if (event === 'unlinkDir') {
    const removedPage = this.pages.find((page) =>
      (page.relativePath === filename)
    )
    if (removedPage) {
      this.pagesToBeRemoved.push(removedPage)
    }
  }

  // TODO: When custom page extensions (.get.js, .data.js etc.) changed
  //       >> Reload them aka parse again
  //       >> but do not re-compile webpack (this.wasRenameEvent = true)

  // Wait for more changes
  this.devWatchTimeout = setTimeout(() => {
    // Reset
    this.wasRenameEvent = false
    this.wasCustomFileEvent = false

    // TODO: ensure to clear modules cache before reloading

    Promise.resolve()
      .then(() => {
        if (this.pagesToBeRemoved.length > 0) {
          const removals = this.pagesToBeRemoved
            .map((page) => this.removePage(page))
          this.pagesToBeRemoved = []
          return Promise.all(removals)
        }
      })
      .then(() => {
        this.log.info('Re-parsing page tree')
        return this.parseGraphs([this.rootPage])
      })
      .then(() => this.postParseLoadSetup(this.pages))
      .then(({ pages }) => this.build(pages))
      .catch((err) => {
        this.log.error('DevWatch build failed', err)
      })
  }, 100)
}

function setupDev (pages) {
  return Promise.resolve().then(() => {
    if (!this.isDEV) {
      throw cannot('setup', 'dev')
        .because('running in production env')
    }

    this.devWatchListenerBound = this.devWatchListener.bind(this)
    this.devWatch(this.rootPath)

    return { pages }
  })
}

module.exports = {
  setupDev,
  devWatch,
  devWatchListener
}
