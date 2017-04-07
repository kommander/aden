const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');

// TODO: Make available as aden.isDEV, use as this.isDEV
const __DEV__ = process.env.NODE_ENV === 'development';

function build(pages, doClean) {
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
    .then((stats) => {
      // Add build info to pages
      // page { ...
      //   build: {
      //     js: public asset path,
      //     style: public asset path,
      //     commons: public asset path,
      //     ...
      //   }
      // }
      this.reducePages(pages)
        .forEach((page) => {
          if (stats.compilation.namedChunks[page.entryName]) {
            const mappedCommons = stats.compilation.namedChunks.commons.files
              .map((file) => `${this.rootConfig.publicPath}${file}`);
            Object.assign(page, {
              build: stats.compilation.namedChunks[page.entryName].files
                .reduce((prev, file) => {
                  ({
                    '.js': () => prev.js.push(`${this.rootConfig.publicPath}${file}`),
                    '.css': () => prev.css.push(`${this.rootConfig.publicPath}${file}`),
                  })[path.parse(file).ext]();
                  return prev;
                }, {
                  js: [],
                  css: [],
                  commons: page.commons ? mappedCommons : [],
                }),
            });
          } else {
            Object.assign(page, { build: {} });
          }
        });
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
