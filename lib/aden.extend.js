'use strict'

const path = require('path')
const cannot = require('brokens')
const _ = require('lodash')
const { nativeRequire } = require('./utils')

const Attitude = require('./attitude')

// TODO: Store available and used attitudes per page

function hook (name, fn) {
  if (!this.hooks[name]) {
    throw cannot('hook into', name).because('a hook with that name does not exist')
  }
  if (this.hooks[name].indexOf(fn) !== -1) {
    throw cannot('hook into', name).because('a hook for that function already exists')
  }
  this.hooks[name].push(fn)

  return this
}

function registerHooks (names) {
  names.forEach((name) => this.registerHook(name))
  return this
}

function registerHook (name) {
  Object.assign(this.hooks, {
    [name]: []
  })
  return this
}

function unhook (name, fn) {
  if (!this.hooks[name]) {
    throw cannot('unhook', name).because('a hook with that name does not exist')
  }
  this.hooks[name].splice(this.hooks[name].indexOf(fn), 1)
  return this
}

function applyHook (name, arg) {
  return Promise.resolve().then(() => {
    const hooksToExec = this.hooks[name]
      .map((hookExec) => Promise.resolve().then(() => hookExec(arg)))

    if (hooksToExec.length > 0) {
      this.log.debug(`Executing hook ${name}`)
    }

    return Promise.all(hooksToExec)
      .then(() => arg)
  })
}

function sortAttitudes (these) {
  const deactivated = these
    .filter((name) => name.match(/^!/))
    .map((name) => name.replace('!', ''))
  return _.uniq(these
    .filter((name) => !name.match(/^!/) && !deactivated.includes(name)))
}

function resolveAttitude (page, attitudeName) {
  const searchPaths = [
    path.join(this.rootPath, page.relativePath, '.attitudes', attitudeName),
    path.join(this.rootPath, page.relativePath, 'node_modules', attitudeName),
    path.join(__dirname, '../attitudes', attitudeName)
  ]

  if (path.isAbsolute(attitudeName)) {
    searchPaths.unshift(attitudeName)
  }

  return searchPaths.find((searchPath) => {
    try {
      return require.resolve(searchPath)
    } catch (e) {
      return false
    }
  })
}

function loadAttitudes (page, which) {
  const attitudes = which.map((name) => {
    const attitudePath = this.resolveAttitude(page, name)

    if (!attitudePath) {
      this.log.warn(cannot('resolve', 'attitude').addInfo(name))
      return false
    }

    const attitudeName = path.isAbsolute(name)
      ? path.parse(name).name
      : name

    return this.loadAttitude(attitudeName, attitudePath)
  })

  return Promise.all(attitudes)
    .then((atts) => atts.filter((plugin) => !!plugin))
}

function loadAttitude (name, fullFilePath) {
  const attitude = this.attitudes[fullFilePath]
  if (attitude) {
    return Promise.resolve(attitude)
  }

  this.attitudes[fullFilePath] = Promise.resolve().then(() => {
    const attitudeFn = nativeRequire(fullFilePath); //eslint-disable-line
    if (typeof attitudeFn !== 'function') {
      this.log.warn(`Invalid attitude at ${fullFilePath}, ignoring`)
      return null
    }

    const attitudeUi = new Attitude(this, name, fullFilePath)
    this.attitudes[fullFilePath] = attitudeUi

    return Promise.resolve()
      .then(() => attitudeFn(attitudeUi))
      .then(() => attitudeUi)
  })

  return this.attitudes[fullFilePath]
}

module.exports = {
  hook,
  unhook,
  applyHook,
  loadAttitudes,
  loadAttitude,
  registerHooks,
  registerHook,
  sortAttitudes,
  resolveAttitude
}
