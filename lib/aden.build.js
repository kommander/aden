const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

function build(pages, webpackConfig) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.executeHook('pre:build', { pages, webpackConfig })
    .then(() => this.compile(webpackConfig)
      .catch((err) => {
        if (this.isDEV) {
          // Still needed as output?
          this.logger.warn('Webpack failed. waiting for changes...', err);
        } else {
          throw err;
        }
      }))
    .then((stats) => this.writeWebpackStats(pages, stats))
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
    // TODO: mark as production build, if so, and lock for other env builds
}

// TODO: save: use page.id -> flatten pages -> map(replace children with ids)
// TODO: load: map(replace children with object references) -> reduce(to pagesById)
function serializePages(pages) {
  return this.walkPages(pages, this.rootConfig, null, null, (page) => {
    let copy = Object.assign({}, page);
    return this.serializePages(page.children)
      .then((children) => {
        copy.children = 'XX_CHILDREN_XX';
        // omit generated attributes (postLoadWalk)
        // ignore and noWatch are not needed to run in production as everything is already parsed
        // TODO: Solve loaders serialization (store locations of .aden files that contain loaders)
        copy = _.omit(copy, [
          'ignore', 'noWatch', 'templateContent', 'loaders',
          'logger', 'subpagePaths', 'resolved',
        ]);
        return JSON.stringify(copy)
          .replace('"XX_CHILDREN_XX"', children);
      });
  })
  .then((results) => `[${results.join(',')}]`);
}

function writePageStats(pages) {
  if (!this.isDEV) {
    this.logger.start('Writing page stats to dist.', {
      resolvedDist: pages[0].resolved.dist,
      pageStatsDist: pages[0].pageStatsDist,
    });

    return this.serializePages(pages)
      .then((pagesJson) => new Promise((resolve, reject) =>
        fs.writeFile(path.resolve(pages[0].resolved.dist, pages[0].pageStatsDist), pagesJson,
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          this.logger.success('Wrote page stats to dist.');
          resolve();
        }))
      );
  }
  return pages;
}

function writeWebpackStats(pages, stats) {
  if (!this.isDEV) {
    this.logger.start('Writing webpack stats to dist.', {
      resolvedDist: pages[0].resolved.dist,
      webpackStatsDist: pages[0].webpackStatsDist,
    });

    const jsonStats = JSON.stringify(stats.toJson());
    return new Promise((resolve, reject) =>
      fs.writeFile(
        path.resolve(pages[0].resolved.dist, pages[0].webpackStatsDist),
        jsonStats,
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          this.logger.success('Wrote webpack stats to dist.');
          resolve(stats);
        }
      )
    );
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
