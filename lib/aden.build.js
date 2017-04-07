const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');

// TODO: Make available as aden.isDEV, use as this.isDEV
const __DEV__ = process.env.NODE_ENV === 'development';

function build(doClean) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.executeHook('pre:build', { rootPage: this.rootPage })
    .then(() => {
      if (doClean) {
        return this.clean();
      }
      return null;
    })
    .then(() => this.compile()
      .catch((err) => {
        if (__DEV__) {
          this.logger.warn('Webpack failed. waiting for changes...', err);
        } else {
          throw err;
        }
      }))
    .then((stats) => {
      if (process.env.NODE_ENV !== 'development') {
        this.logger.start('Writing webpack stats to dist.');

        const jsonStats = JSON.stringify(stats.toJson());
        return new Promise((resolve, reject) =>
          fs.writeFile(this.webpackStatsDist, jsonStats, (err) => {
            if (err) reject(err);
            this.logger.success('Wrote webpack stats to dist.');
            resolve();
          }));
      }
      return stats;
    })
    .then(() => this.executeHook('post:build', { rootPage: this.rootPage }));
}

function clean() {
  return new Promise((resolve, reject) => {
    // Clear dist folder before build...
    rimraf(this.rootConfig.dist, (rmErr) => {
      if (rmErr) {
        reject(rmErr);
        return;
      }
      resolve();
    });
  });
}

module.exports = {
  build,
  clean,
};
