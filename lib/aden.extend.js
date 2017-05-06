'use strict';

const fs = require('fs');
const path = require('path');
const cannot = require('cannot');

// TODO: Store available and used plugins per page

function hook(name, fn) {
  if (!this.hooks[name]) {
    throw cannot('hook into', name).because('a hook with that name does not exist');
  }
  if (this.hooks[name].indexOf(fn) !== -1) {
    throw cannot('hook into', name).because('a hook for that function already exists');
  }
  this.hooks[name].push(fn);

  return this;
}

function unhook(name, fn) {
  if (!this.hooks[name]) {
    throw cannot('unhook', name).because('a hook with that name does not exist');
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

  const appAttitudesPath = path.resolve(this.rootPath, '.attitudes');

  // TODO: app level attitudes should override native ones with same name
  return new Promise((resolve, reject) => {
    fs.readdir(attitudesPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT') {
          this.log.warn('Trying to load attitudes from ENOENT');
          resolve([]);
          return;
        }
        reject(err);
        return;
      }
      resolve(files);
    });
  })
  .then((coreAttitudes) => new Promise((resolve, reject) => {
    fs.readdir(appAttitudesPath, (err, files) => {
      if (err) {
        if (err.code === 'ENOENT') {
          resolve({ coreAttitudes, appAttitudes: [] });
          return;
        }
        reject(err);
        return;
      }
      resolve({ coreAttitudes, appAttitudes: files });
    });
  }))
  .then(({ coreAttitudes, appAttitudes }) => {
    const attitudes = which.map((name) => {
      let finalAttitude;

      if (name.match(/^\//)) {
        finalAttitude = name;
      } else {
        const appAttitude = appAttitudes
          .find((file) => (path.parse(file).name === name));
        const coreAttitude = coreAttitudes
          .find((file) => (path.parse(file).name === name));

        if (appAttitude) {
          finalAttitude = path.resolve(appAttitudesPath, appAttitude);
        } else if (coreAttitude) {
          finalAttitude = path.resolve(attitudesPath, coreAttitude);
        }
      }

      if (finalAttitude) {
        const fileStats = fs.statSync(finalAttitude);

        if (fileStats.isDirectory()) {
          // Load complex attitudes from folders with index.js
          return this.loadAttitude(path.resolve(finalAttitude, 'index.js'));
        }
        return this.loadAttitude(finalAttitude);
      }
      return false;
    })
    .filter((plugin) => !!plugin);

    return Promise.all(attitudes);
  });
}

function loadAttitude(fullFilePath) {
  return Promise.resolve().then(() => {
    const attitude = this.nativeRequire(fullFilePath); //eslint-disable-line
    if (typeof attitude !== 'function') {
      this.log.warn(`Invalid attitude at ${fullFilePath}, ignoring`);
      return null;
    }

    const attitudeWrapper = {
      path: fullFilePath,
      fn: attitude,
    };

    this.attitudes.push(attitudeWrapper);

    return Promise.resolve()
      .then(() => attitude(this.ui));
  });
}

module.exports = {
  hook,
  unhook,
  applyHook,
  loadAttitudes,
  loadAttitude,
};
