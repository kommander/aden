const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const _ = require('lodash');

// TODO: add something like addPageToWebpackConfig(page)
// (reducing applyPageOnWebpack && updatePageConfig)

function generateWebpackConfig(loadedPages) {
  this.logger.start('Generating webpack config');

  // Generate base configs
  return Promise.resolve({
    pages: loadedPages,
    webpackConfigs: [
      {
        target: 'web',
        entry: {
          // Entries are added per page by aden
        },
      },
    ],
  })
  .then(({ pages, webpackConfigs }) => {
    const paths = {
      distPath: path.resolve(this.rootConfig.dist, 'public'),
      aden_node_modules: path.resolve(__dirname, '../node_modules'),
      aden: path.resolve(__dirname, '../'),
    };

    this.logger.debug(`Setting up paths ${JSON.stringify(paths)}`);

    // TODO: Prepare for webpack@2
    _.merge(webpackConfigs[0], {
      // TODO: Use id and hash only based setup for production
      output: {
        path: paths.distPath,
        publicPath: this.rootConfig.publicPath,
      },
      context: this.rootConfig.rootPath,
      resolve: {
        // TODO: Take from aden extensions
        extensions: ['', '.js', '.jsx', '.json', '.css', '.html'],
        root: [],
        fallback: paths.aden_node_modules,
      },
      resolveLoader: {
        root: [
          paths.aden_node_modules,
        ],
      },
      plugins: [],
      module: {
        noParse: [
          /\.git/, /\.dist/,
        ],
        loaders: [],
      },
      devtool: this.isDEV ? 'source-map' : false,
    });

    _.merge(webpackConfigs.backend, {
      // ...
    });

    return { pages, webpackConfigs, paths };
  })
  // Apply pages
  .then(({ pages, webpackConfigs, paths }) =>
    this.walkPages(pages, null, (page) => {
      this.logger.info(`Applying page ${page.route} to webpackConfigs`, null, null, {
        page: _.pick(page, ['name', 'resolved', 'route', 'send']),
      });

      if (page.createEntry === false) {
        return page;
      }

      // Push client entry point to beginning
      const webpackEntry = [
        path.resolve(__dirname, './client/index.js'),
      ];

      if (this.isDEV) {
        // TODO: Make it work without reload, move to dev setup as hook
        webpackEntry.unshift(
          `webpack-hot-middleware/client?reload=true&path=${
            pages[0].basePath}${this.config.hmrPath}`);
      }

      return Promise.resolve({ webpackConfigs, page, webpackEntry, paths })
        .then(args => {
          const entry = args.webpackEntry;

          Object.assign(page, {
            entry,
          });

          webpackConfigs.forEach((webpackConfig) => _.merge(webpackConfig, {
            resolve: {
              root: webpackConfig.resolve.root.concat([
                page.key.path.resolved,
                page.key.shared.resolved,
                // path.resolve(page.key.path.resolved, '../node_modules'),
                // path.resolve(page.key.path.resolved, '../../node_modules'),
                paths.aden_node_modules,
              ]),
            },
            resolveLoader: {
              root: [
                paths.aden_node_modules,
              ],
            },
            module: {
              loaders: webpackConfig.module.loaders.concat(page.loaders.map((loader) =>
                Object.assign(loader, {
                  include: (loader.include || []).concat([
                    page.key.path.resolved,
                    paths.aden_node_modules,
                    // path.resolve(page.key.path.resolved, 'node_modules'),
                    // path.resolve(page.key.path.resolved, '../node_modules'),
                    // path.resolve(page.key.path.resolved, '../../node_modules'),
                  ]),
                })
              )),
            },
          }));

          // Add loaders from pages
          // TODO: Ensure include paths are relative to app

          return this.applyHook('apply', args)
            .then((hooked) => {
              Object.assign(webpackConfigs[0], {
                entry: Object.assign(webpackConfigs[0].entry, {
                  [hooked.page.entryName]: hooked.webpackEntry,
                }),
              });
              return hooked;
            })
            .then((applied) => applied.page);
        });
    })
    .then(() => ({ pages, webpackConfigs, paths }))
    .then((args) => this.applyHook('post:apply', args))
  )
  .then(({ pages, webpackConfigs /* , paths */ }) => {
    // DEV: Apply page plugins to existing compiler
    if (this.compiler) {
      webpackConfigs[0].plugins.forEach((plugin) =>
        this.compiler.apply(plugin));
    }

    // exclude aden from loaders
    // Object.assign(webpackConfigs[0].module, {
    //   loaders: webpackConfigs[0].module.loaders.map((loader) => {
    //     if (!Array.isArray(loader.exclude)) {
    //       Object.assign(loader, {
    //         exclude: loader.exclude ? [loader.exclude] : [],
    //       });
    //     }
    //
    //     return Object.assign(loader, {
    //       exclude: (loader.exclude || []), // .concat(paths.aden),
    //     });
    //   }),
    // });

    // Get plugins in order
    const orderedPlugins = [];

    // Plugins
    const chunks = this.flattenPages(pages)
      .map((page) => page.entryName);

    orderedPlugins.push(
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'commons',
        filename: 'commons.js',
        chunks,
        minChunks: 2,
      })
    );

    // Output
    // Keep in sync with page build info
    if (this.isDEV) {
      Object.assign(webpackConfigs[0], {
        output: Object.assign(webpackConfigs[0].output, {
          filename: '[name].js',
          chunkFilename: '[id].chunk.js',
          sourceMapFilename: '[name].map',
        }),
      });
    } else {
      Object.assign(webpackConfigs[0], {
        output: Object.assign(webpackConfigs[0].output, {
          filename: '[name].js',
          chunkFilename: '[id].chunk.js',
          sourceMapFilename: '[name].map',
        }),
      });
    }

    orderedPlugins.push(new webpack.DefinePlugin({
      __DEV__: this.isDEV,
      __PROD__: this.isPROD ? 'true' : 'false',
      __TEST__: process.env.NODE_ENV === 'test' ? 'true' : 'false',
      __ENV__: this.isDEV,
    }));

    if (this.isDEV) {
      Object.assign(webpackConfigs[0], {
        debug: true,
        cache: false,
      });
      orderedPlugins.push(new HotModuleReplacementPlugin());
    }

    if (this.isPROD) {
      orderedPlugins.push(new webpack.optimize.UglifyJsPlugin());
    }

    Object.assign(webpackConfigs[0], {
      plugins: orderedPlugins.concat(webpackConfigs[0].plugins),
    });

    this.webpackConfigs = webpackConfigs;

    this.logger.debug('Generated Webpack Config', {
      conf: _.pick(webpackConfigs[0], [
        'entry', 'includePaths', 'resolve', 'module',
      ]),
    });

    return { pages, webpackConfigs };
  });
}

// TODO: >> Reduce available webpack config to loaders/plugins (inherited and overridden per page)
//       >> using page local node_modules first,
//          then root node_modules and aden node_modules as fallback
function compile(webpackConfigs) {
  return Promise.resolve().then(() => {
    this.logger.start('Compiling');

    if (!this.compiler) {
      this.compiler = webpack(webpackConfigs);
    }

    if (this.compilerIsRunning !== true) {
      this.compilerIsRunning = true;
      return new Promise((resolve, reject) => this.compiler.run((err, stats) => {
        this.compilerIsRunning = false;
        if (err) {
          reject(err);
          return;
        }

        const jsonStats = stats.toJson();

        if (jsonStats.errors.length > 0) {
          this.nextCompilationScheduled = false;
          this.logger.warn(`!!! Webpack errors ${jsonStats.errors[0]}`);
          reject(new Error(JSON.stringify(jsonStats.errors[0])));
          return;
        }

        const warnings = stats.compilation
          ? stats.compilation.warnings
          : jsonStats.warnings;

        if (warnings && warnings.length > 0) {
          this.logger.warn('!!! Webpack warnings', warnings);
        }

        this.logger.success(`Webpack done in ${stats.endTime - stats.startTime}ms`, null, stats);

        // TODO: handle scheduling outside of compile
        if (this.nextCompilationScheduled === true) {
          this.nextCompilationScheduled = false;
          this.logger.info('Running next scheduled compilation');
          resolve(this.compile(this.webpackConfigs));
          return;
        }

        this.webpackStats = stats;

        resolve(stats);
      }));
    }

    this.nextCompilationScheduled = true;
    this.logger.info('Webpack already running, next compilation scheduled.');
    return null;
  });
}

module.exports = {
  generateWebpackConfig,
  compile,
};
