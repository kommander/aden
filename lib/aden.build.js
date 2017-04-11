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
      this.flattenPages(pages)
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

function serializer(pages) {
  return this.flattenPages(pages)
    .map((page) =>
      Object.assign(_.omit(page, [
        'ignore', 'noWatch', 'templateContent', 'loaders',
        'logger', 'subpagePaths', 'resolved',
      ]), {
        children: page.children.map((child) => child.id),
      })
    );
}

// save: use page.id -> flatten pages -> map(replace children with ids)
// load: map(replace children with object references) -> reduce(to pagesById)
// TODO: Do not serialize aden default pages
function serializePages(pages) {
  return Promise.resolve().then(() => {
    const serials = this.serializer(pages);
    const result = {
      pages: serials,
      info: {
        registered: pages.map((page) => page.id),
        rootPage: pages[0].id,
      },
    };
    return JSON.stringify(result);
  });
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
  serializer,
};
