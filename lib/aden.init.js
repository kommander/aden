'use strict'

const path = require('path')
const cannot = require('brokens')
const packageJson = require('../package.json')

process.__ADEN__ = false

async function buildTask () {
  await this.clean()
  await this.parseGraphs(this.pages)
  await this.applyHook('init', { rootPage: this.rootPage })
  const { pages } = await this.postParseLoadSetup(this.pages)
  await this.build(pages)
  return this
}

function cleanTask () {
  return this.clean()
    .then(() => this)
}

async function runDevTask () {
  await this.clean()
  await this.parseGraphs(this.pages)
  await this.applyHook('init', { rootPage: this.rootPage })
  const { pages } = (await this.postParseLoadSetup(this.pages))
  await this.build(pages)
  await this.setupDev(pages)
  await this.runStartupCallback(pages)
  return this
}

async function runProductionTask () {
  const pages = await this.loadBuild(this.rootPage)
  await this.postBuildLoadSetup(pages)
  await this.runStartupCallback(pages)
  return this
}

function runDeployTask (opts = {}) {
  return this.loadBuild(this.rootPage)
    .then((pages) => this.postBuildLoadSetup(pages))
    .then((pages) => {
      const target = opts.target || 'default'
      const targetFn = (this.deployTargets[target] || {}).fn
      if (!targetFn) {
        this.log.warn(`No deploy target for ${target}`)
        return { pages, target }
      }

      return Promise.resolve()
        .then(() => this.applyHook('pre:deploy', { pages, target }))
        .then(() => this.applyHook('deploy', { pages, target }))
        .then((args) => targetFn(args))
        .then(() => this.applyHook('post:deploy', { pages, target }))
    })
    .then(() => this)
}

function init (initPath, focusPath) {
  return Promise.resolve().then(() => {
    if (process.__ADEN__) {
      throw new Error('Fatal: Only call aden.init() once per process.')
    }
    process.__ADEN__ = true

    const rootPath = this.rootPath = path.resolve(initPath)
    this.focusPath = focusPath || false

    try {
      const appPackageJson = require(path.resolve(rootPath, 'package.json'))
      this.name = appPackageJson.name
    } catch (ex) {
      this.name = path.parse(rootPath).name.toUpperCase()
    }

    this.version = packageJson.version

    this.log.debug('Initializing Aden', {
      rootPath, focusPath, settings: this.settings
    })

    this.tasks = {
      build: buildTask,
      clean: cleanTask,
      dev: runDevTask,
      production: runProductionTask,
      deploy: runDeployTask
    }

    this.rootPage = this.registerPage(rootPath)
  })
  .then(() => this.loadDotServerFile(this.rootPath, true))
  .then((fileConfig) => {
    let dist = process.env.ADEN_DIST || fileConfig.dist || this.settings.dist

    if (!path.isAbsolute(dist)) {
      dist = path.resolve(this.rootPath, dist)
    }

    Object.assign(this.settings, {
      dist
    })
  })
  .then(() => this)
}

function run (task, opts) {
  return Promise.resolve().then(() => {
    const taskFn = this.tasks[task]
    if (!taskFn) {
      throw cannot('run', task).because('it does not exist')
    }
    return taskFn.call(this, opts)
  })
}

function runStartupCallback (pages) {
  if (typeof pages[0].startup.value === 'function') {
    return Promise.resolve()
      .then(() => pages[0].startup.value(this))
      .then(() => ({ pages }))
  }
  return Promise.resolve({ pages })
}

module.exports = {
  init,
  run,
  runStartupCallback
}
