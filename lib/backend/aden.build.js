const rimraf = require('rimraf');

// TODO: Make available as aden.isDEV, use as this.isDEV
const __DEV__ = process.env.NODE_ENV === 'development';

function build(clean) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.executeHook('pre:build', { rootPage: this.rootPage })
    .then(() => {
      if (clean) {
        return new Promise((resolve, reject) => {
          // Clear dist folder before build...
          rimraf(this.rootPage.dist, (rmErr) => {
            if (rmErr) {
              reject(rmErr);
              return;
            }
            resolve();
          });
        });
      }
      return Promise.resolve();
    })
    .then(() => this.compile()
      .catch((err) => {
        if (__DEV__) {
          this.logger.warn('Webpack failed. waiting for changes...', err);
        } else {
          throw err;
        }
      }))
    .then(() => this.executeHook('post:build', { rootPage: this.rootPage }));
}

module.exports = {
  build,
};
