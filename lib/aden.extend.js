'use strict';

const fs = require('fs');
const path = require('path');
const cannot = require('cannot');

// TODO: Store available and used plugins per page

function hook(name, fn) {
  if (!this.hooks[name]) {
    throw cannot('hook into', name).because('a hook with that name does not exist'); // eslint-disable-line
  }
  if (this.hooks[name].indexOf(fn) !== -1) {
    throw cannot('hook into', name).because('a hook for that function already exists'); // eslint-disable-line
  }
  this.hooks[name].push(fn);

  return this;
}

function unhook(name, fn) {
  if (!this.hooks[name]) {
    throw cannot('unhook', name).because('a hook with that name does not exist'); // eslint-disable-line
  }
  this.hooks[name].splice(this.hooks[name].indexOf(fn), 1);
}

// TODO: Scope hooks to page (apply hooks to a page and return a new immutable)
// TODO: Straighten out hooks sync/async/mutable/immutable
function applyHook(name, arg) {
  return Promise.resolve().then(() => {
    const hooksToExec = this.hooks[name]
      .map((hookExec) => Promise.resolve().then(() => hookExec.call(null, arg)));

    if (hooksToExec.length > 0) {
      this.log.debug(`Executing hook ${name}`);
    }

    return Promise.all(hooksToExec)
      .then(() => arg);
  });
}

function loadAttitudes(attitudesPath, these) {
  const deactivated = these
    .filter((name) => name.match(/^!/))
    .map((name) => name.replace('!', ''));
  const which = these
    .filter((name) => !name.match(/^!/) && !deactivated.includes(name));

  // TODO: app level attitudes should override native ones with same name
  return new Promise((resolve, reject) => {
    fs.readdir(attitudesPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT') {
          this.log.warn('Trying to load attitudes from ENOENT');
          resolve();
          return;
        }
        reject(err);
        return;
      }

      const attitudes = files.map((file) => {
        const fullFilePath = path.resolve(attitudesPath, file);
        const fileStats = fs.statSync(fullFilePath);
        const fileInfo = path.parse(fullFilePath);

        if (which.includes(fileInfo.name)) {
          if (fileStats.isDirectory()) {
            // Load complex attitudes from folders with index.js
            return this.loadAttitude(fullFilePath, 'index.js');
          }
          return this.loadAttitude(attitudesPath, file);
        }
        return false;
      })
      .filter((plugin) => !!plugin);

      // TODO: Load attitudes in the order specified in the config

      Promise.all(attitudes)
        .then(() => resolve())
        .catch(attitudeErr => reject(attitudeErr));
    });
  });
}

function loadAttitude(dirPath, fileName) {
  const fullFilePath = path.resolve(dirPath, fileName);

  return Promise.resolve().then(() => {
    const plugin = require(fullFilePath); //eslint-disable-line
    if (typeof plugin !== 'function') {
      this.log.warn(`Invalid plugin at ${fullFilePath}, ignoring`);
      return null;
    }

    const pluginWrapper = {
      path: fullFilePath,
      fn: plugin,
    };

    this.attitudes.push(pluginWrapper);

    return Promise.resolve()
      .then(() => plugin(this.ui));
  });
}

module.exports = {
  hook,
  unhook,
  applyHook,
  loadAttitudes,
  loadAttitude,
};
