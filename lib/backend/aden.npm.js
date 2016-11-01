const npm = require('npm');
const path = require('path');
const fs = require('fs');

function installRoot(rootPage) {
  return this.executeHook('pre:install', { rootPage })
    .then(() => this.installPage(rootPage))
    .then(() => this.executeHook('post:install', { rootPage }));
}

function installPage(page) {
  this.logger.info('Installing page...', { page });

  return this.runNpm(page.path)
    .then(() => page.children.forEach(childPage => {
      this.runNpm(childPage.path);
    }));
}

// TODO: Gather package.json info on page parse,
//       actually, provide the whole package.json/npm as parse plugin
// TODO: Specifying plugins in the config controls the order of the sync part, not the async part
// TODO: Improve this to gather all dependencies when parsing
//       and installing them on root level.
function runNpm(dirPath) {
  return new Promise((resolve, reject) => {
    const packagePath = path.resolve(dirPath, 'package.json');

    fs.access(packagePath, fs.F_OK | fs.R_OK, (noPackage) => {
      if (noPackage) {
        resolve();
        return;
      }

     // Make sure npm is only run once for a path in a process
      if (this.installedPaths.indexOf(packagePath) !== -1) {
        resolve();
        return;
      }

      try {
        this.logger.info('Found plugin package.json, loading npm.', {
          dirPath,
        });

        npm.load({
          prefix: dirPath,
        }, (npmErr) => {
          if (npmErr) {
            reject(npmErr);
            return;
          }
          npm.commands.install([], (npmInstallErr /* , data */) => {
            if (npmInstallErr) {
              reject(npmInstallErr);
              return;
            }

            this.installedPaths.push(packagePath);
            resolve();
          });
        });
      } catch (ex) {
        reject(ex);
      }
    });
  });
}

module.exports = {
  installRoot,
  installPage,
  runNpm,
};
