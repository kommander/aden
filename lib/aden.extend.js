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

function loadExtensions(extensionsPath, which) {
  // TODO: app level extensions should override native ones with same name
  return new Promise((resolve, reject) => {
    fs.readdir(extensionsPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT') {
          this.log.warn('Trying to load extensions from ENOENT');
          resolve();
          return;
        }
        reject(err);
        return;
      }

      const extensions = files.map((file) => {
        const fullFilePath = path.resolve(extensionsPath, file);
        const fileStats = fs.statSync(fullFilePath);
        const fileInfo = path.parse(fullFilePath);

        if (which.includes(fileInfo.name)) {
          if (fileStats.isDirectory()) {
            // Load complex extensions from folders with index.js
            return this.loadExtension(fullFilePath, 'index.js');
          }
          return this.loadExtension(extensionsPath, file);
        }
        return false;
      })
      .filter((plugin) => !!plugin);

      // TODO: Load extensions in the order specified in the config

      Promise.all(extensions)
        .then(() => resolve())
        .catch(extensionErr => reject(extensionErr));
    });
  });
}

function loadExtension(dirPath, fileName) {
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

    this.extensions.push(pluginWrapper);

    return Promise.resolve()
      .then(() => plugin(this.ui));
  });
}

module.exports = {
  hook,
  unhook,
  applyHook,
  loadExtensions,
  loadExtension,
};
