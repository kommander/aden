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
}

function unhook(name, fn) {
  if (!this.hooks[name]) {
    throw cannot('unhook', name).because('a hook with that name does not exist'); // eslint-disable-line
  }
  this.hooks[name].splice(this.hooks[name].indexOf(fn), 1);
}

// TODO: Scope hooks to page (apply hooks to a page and return a new immutable)
// TODO: Straighten out hooks sync/async/mutable/immutable
// TODO: rename to apply hook
function applyHook(name, arg) {
  return Promise.resolve().then(() => {
    const hooksToExec = this.hooks[name]
      .map((hookExec) => hookExec.call(null, arg));

    if (hooksToExec.length > 0) {
      this.logger.debug(`Executing hook ${name}`);
    }

    return Promise.all(hooksToExec)
      .then(() => arg);
  });
}

function loadPlugins(pluginsPath) {
  // TODO: Error on used plugins (.aden) not available
  return new Promise((resolve, reject) => {
    fs.readdir(pluginsPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve();
          return;
        }
        reject(err);
        return;
      }

      const plugins = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fullFilePath = path.resolve(pluginsPath, file);
        const fileStats = fs.statSync(fullFilePath);
        // const fileInfo = path.parse(fullFilePath);

        if (fileStats.isDirectory()) {
          // Load complex plugins from folders with index.js
          plugins.push(this.loadPlugin(fullFilePath, 'index.js'));
        } else {
          plugins.push(this.loadPlugin(pluginsPath, file));
        }
      }

      // TODO: Load plugins in the order specified in the config

      Promise.all(plugins)
        .then(() => resolve())
        .catch(pluginErr => reject(pluginErr));
    });
  });
}

function loadPlugin(dirPath, fileName) {
  const fullFilePath = path.resolve(dirPath, fileName);

  if (this.pluginPaths.indexOf(fullFilePath) !== -1) {
    const plugin = this.pluginPaths[fullFilePath];
    return Promise.resolve()
      .then(() => plugin(this));
  }

  return Promise.resolve().then(() => {
    const plugin = require(fullFilePath); //eslint-disable-line
    if (typeof plugin !== 'function') {
      this.logger.warn(`Invalid plugin at ${fullFilePath}, ignoring`);
      return null;
    }
    const pluginWrapper = {
      path: fullFilePath,
      fn: plugin,
    };
    this.pluginPaths.push(fullFilePath);
    this.plugins.push(pluginWrapper);
    return Promise.resolve()
      .then(() => plugin(this));
  });
}

module.exports = {
  hook,
  unhook,
  applyHook,
  loadPlugins,
  loadPlugin,
};
