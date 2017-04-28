const AdenConstants = require('./aden.constants');

const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

function build(pages, webpackConfigs) {
  this.logger.info('Building Aden app', { rootPage: this.rootPage });

  // TODO: Separate out into clean task
  return this.applyHook('pre:build', { pages, webpackConfigs })
    .then(() => this.compile(webpackConfigs)
      .catch((err) => {
        if (this.isDEV) {
          // Still needed as output?
          this.logger.warn('Webpack failed. waiting for changes...');
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
          // If there's no stats, the webpack build probably failed and in dev we move on
          // TODO: Handle multi stats
          if (stats && stats[0].compilation.namedChunks[page.entryName]) {
            let commonFiles = stats[0].compilation.namedChunks.commons.files.slice();

            if (stats[0].compilation.namedChunks.global) {
              commonFiles = commonFiles.concat(
                stats[0].compilation.namedChunks.global.files);
            }

            const mappedCommons = commonFiles
              .filter((file) => (!file.match(/\.map$/)))
              .map((file) => `${this.rootConfig.publicPath}${file}`);
            Object.assign(page, {
              build: stats[0].compilation.namedChunks[page.entryName].files
                .filter((file) => ['.js', '.css'].includes(path.parse(file).ext))
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
    // maybe obsolete with webpack bcknd bld
    .then(() => this.walkPages(pages, pages[0], (page) =>
      Promise.resolve().then(() => {
        // Backend build
        const keys = page.keys.map((key) => {
          if (typeof key.build === 'function' && key.value) {
            return key.build(page, key);
          }
          return null;
        })
        .filter((key) => !!key);
        return Promise.all(keys)
          .then(() => page);
      })
    ))
    .then(() => this.writePageStats(pages))
    .then(() => this.applyHook('post:build', { pages, webpackConfigs }));
    // TODO: mark as production build, if so, and lock for other env builds
}

function serializer(pages) {
  return this.flattenPages(pages)
    .map((page) =>
      Object.assign(_.omit(page, [
        'ignore', 'noWatch', 'templateContent', 'rules',
        'logger', 'subpagePaths', 'resolved', 'defaults',
        'webpackStatsDist', 'pageStatsDist', 'dist',
        'rootPath', 'htmlFileFullPath', 'htmlPlugin',
        'entry', 'greedy', 'key', 'pagePath',
      ]), {
        children: page.children.map((child) => child.id),
        keys: page.keys
          .filter((key) => key.store)
          .map((key) => {
            if (key.type === AdenConstants.KEY_TYPE_FILE_ARRAY) {
              Object.assign(key, {
                value: key.value.map((file) => _.omit(file, [
                  'resolved', 'dir', 'dist', 'default',
                ])),
              });
            }

            if (key.type === AdenConstants.KEY_TYPE_CUSTOM) {
              Object.assign(key, {
                value: typeof key.serialize === 'function'
                  ? key.serialize(key.value)
                  : {},
              });
            }

            return _.omit(key, [
              'resolved', 'dir', 'dist', 'default',
            ]);
          }),
      })
    );
}

// save: use page.id -> flatten pages -> map(replace children with ids)
// load: map(replace children with object references) -> reduce(to pagesById)
// TODO: Do not serialize aden default pages
// TODO: write aden version to build and check for compat before running
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
    this.logger.start('Writing page stats to dist.');

    const filePath = path.resolve(this.rootConfig.dist, this.config.pageStatsDist);

    return this.serializePages(pages)
      .then((pagesJson) => new Promise((resolve, reject) =>
        fs.writeFile(
          filePath,
          pagesJson,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            this.logger.success('Wrote page stats to dist.', {
              pagesJson,
            });
            resolve();
          })
        )
      );
  }
  return pages;
}

function writeWebpackStats(pages, stats) {
  if (!this.isDEV) {
    this.logger.start('Writing webpack stats to dist.');

    const jsonStats = stats
      .map((stat) => JSON.stringify(stat.toJson()))
      .join(',');

    return new Promise((resolve, reject) =>
      fs.writeFile(
        path.resolve(this.rootConfig.dist, this.config.webpackStatsDist),
        `[${jsonStats}]`,
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
function clean(/* pages */) {
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
