const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

// TODO: Make available as aden.isDEV, use as this.isDEV
const __DEV__ = process.env.NODE_ENV === 'development';

function build(pages, webpackConfig) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.executeHook('pre:build', { pages, webpackConfig })
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
      // TODO: Use walkPages
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

// TODO: save: use page.id -> flatten pages -> map(replace children with ids)
// TODO: load: map(replace children with object references) -> reduce(to pagesById)
function serializePages(pages) {
  return this.walkPages(pages, this.rootConfig, null, null, (page) => {
    let copy = Object.assign({}, page);
    return this.serializePages(page.children)
      .then((children) => {
        copy.children = 'XX_CHILDREN_XX';
        // omit attributes added to run a page (_runtime)
        // TODO: Solve ignores and no watch, compile to string regex for saving
        // TODO: Solve loaders serialization (store locations of .aden files that contain loaders)
        copy = _.omit(copy, ['ignore', 'noWatch', 'templateContent', 'loaders']);
        // console.log('stringify', copy);
        return JSON.stringify(copy)
          .replace('"XX_CHILDREN_XX"', children);
      });
  })
  .then((results) => `[${results.join(',')}]`);
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

// Clear dist folders
// TODO: take rootPage - walk pages and check for dist folders in tree
function clean() {
  return new Promise((resolve, reject) => {
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
