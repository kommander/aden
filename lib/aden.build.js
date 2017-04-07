const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

// TODO: Make available as aden.isDEV, use as this.isDEV
const __DEV__ = process.env.NODE_ENV === 'development';

function build(pages, webpackConfig, doClean) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.executeHook('pre:build', { pages, webpackConfig })
    .then(() => {
      if (doClean) {
        return this.clean();
      }
      return null;
    })
    .then(() => this.compile(webpackConfig)
      .catch((err) => {
        if (__DEV__) {
          // Still needed as output?
          this.logger.warn('Webpack failed. waiting for changes...', err);
        } else {
          throw err;
        }
      }))
    .then((stats) => this.writeWebpackStats(stats))
    .then((stats) => {
      // Add build info to pages
      this.reducePages(pages)
        .forEach((page) => {
          if (stats && stats.compilation.namedChunks[page.entryName]) {
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
    .then(() => this.writePageStats(pages))
    .then(() => this.executeHook('post:build', { pages, webpackConfig }));
}

function serializePages(pages) {
  return this.walkPages(pages, this.rootConfig, null, null, (page) => {
    let copy = Object.assign({}, page);
    return this.serializePages(page.children)
      .then((children) => {
        copy.children = 'XX_CHILDREN_XX';
        copy = _.omit(copy, ['ignore', 'noWatch', 'templateContent', 'loaders']);
        return JSON.stringify(copy)
          .replace('"XX_CHILDREN_XX"', children);
      });
  })
  .then((results) => results.join(','))
  .then((serial) => `[${serial}]`);
}

function writePageStats(pages) {
  if (process.env.NODE_ENV !== 'development') {
    this.logger.start('Writing page stats to dist.');

    return this.serializePages(pages)
      .then((pagesJson) => new Promise((resolve, reject) =>
        fs.writeFile(this.pageStatsDist, pagesJson, (err) => {
          if (err) reject(err);
          this.logger.success('Wrote page stats to dist.');
          resolve();
        }))
      );
  }
  return pages;
}

function writeWebpackStats(stats) {
  if (process.env.NODE_ENV !== 'development') {
    this.logger.start('Writing webpack stats to dist.');

    const jsonStats = JSON.stringify(stats.toJson());
    return new Promise((resolve, reject) =>
      fs.writeFile(this.webpackStatsDist, jsonStats, (err) => {
        if (err) reject(err);
        this.logger.success('Wrote webpack stats to dist.');
        resolve(stats);
      }));
  }
  return stats;
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
  writeWebpackStats,
  writePageStats,
  serializePages,
};
