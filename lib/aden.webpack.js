const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const _ = require('lodash');

// TODO: add something like addPageToWebpackConfig(page)
// (reducing applyPageOnWebpack && updatePageConfig)

// IDEA: if commons are false for a page,
// it could be a separe webpack config and therefor separate compiler instance?

function generateWebpackConfig(loadedPages) {
  this.log.start('Generating webpack config');

  // Reset watch keys as they will get added when iterating over pages
  this.watchKeys = [];

  // Generate base configs
  return Promise.resolve({
    pages: loadedPages,
    webpackConfigs: [
      {
        // target: 'web',
        entry: {
          // Entries are added per page by aden
        },
        commonChunks: [],
      },
    ],
  })
  .then(({ pages, webpackConfigs }) => {
    const paths = {
      distPath: path.resolve(this.rootConfig.dist, 'public'),
      aden_node_modules: path.resolve(__dirname, '../node_modules'),
      aden: path.resolve(__dirname, '../'),
    };

    this.log.debug(`Setting up paths ${JSON.stringify(paths)}`);

    _.merge(webpackConfigs[0], {
      // TODO: Use id and hash only based setup for production
      output: {
        path: paths.distPath,
        publicPath: this.rootConfig.publicPath,
      },
      context: this.rootConfig.rootPath,
      resolve: {
        // TODO: Take from aden extensions
        extensions: ['.js', '.jsx', '.json', '.css', '.html', '.scss'],
        modules: [
          paths.aden_node_modules,
        ],
      },
      plugins: [],
      module: {
        noParse: [
          /\.git/, /\.dist/,
        ],
        rules: [],
      },
      devtool: this.isDEV ? 'source-map' : false,
    });

    return { pages, webpackConfigs, paths };
  })
  // Apply pages
  .then(({ pages, webpackConfigs, paths }) =>
    this.walkPages(pages, null, (page) => {
      this.log.info(`Applying page ${page.route} to webpackConfigs`, null, null, {
        page: _.pick(page, ['name', 'resolved', 'route', 'send']),
      });

      if (page.createEntry === false) {
        return page;
      }

      // Push client entry point to beginning
      const webpackEntry = [
        path.resolve(__dirname, 'client/index.js'),
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

          Object.assign(args.page, {
            entry,
          });

          webpackConfigs.forEach((webpackConfig) => _.merge(webpackConfig, {
            resolve: {
              modules: webpackConfig.resolve.modules.concat([
                page.key.path.resolved,
                page.key.shared.resolved,
                path.resolve(page.key.path.resolved, 'node_modules'),
                path.resolve(page.key.path.resolved, '../node_modules'),
                path.resolve(page.key.path.resolved, '../../node_modules'),
              ]),
            },
            module: {
              rules: webpackConfig.module.rules.concat(page.rules.map((rule) => {
                const excludes = !Array.isArray(rule.exclude)
                  ? [rule.exclude]
                  : rule.exclude;

                return Object.assign(rule, {
                  include: (rule.include || []).concat([
                    page.rootPath,
                    page.key.path.resolved,
                    paths.aden_node_modules,
                    path.resolve(page.key.path.resolved, 'node_modules'),
                    // path.resolve(page.key.path.resolved, '../node_modules'),
                    // path.resolve(page.key.path.resolved, '../../node_modules'),
                  ]),
                  exclude: excludes.concat([
                    // exclude default pages from app level rules
                    path.resolve(__dirname, 'pages'),
                  ]),
                });
              })),
            },
          }));

          // Add rules from pages
          Array.prototype.push.apply(this.watchKeys, args.page.keys
            .filter((key) => (key.watch === true)));

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

    // Get plugins in order
    const orderedPlugins = [];

    // Plugins
    const chunks = this.flattenPages(pages)
      .map((page) => page.entryName)
      .concat(webpackConfigs[0].commonChunks);

    orderedPlugins.push(
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
      'process.env.NODE_ENV': JSON.stringify(this.isPROD ? 'production' : 'development'),
    }));

    if (this.isDEV) {
      Object.assign(webpackConfigs[0], {
        cache: false,
      });
      orderedPlugins.push(new HotModuleReplacementPlugin());
    }

    if (this.isPROD) {
      orderedPlugins.push(new webpack.optimize.UglifyJsPlugin({
        sourceMap: !this.isPROD,
        compress: {
          warnings: !this.isPROD,
        },
      }));
    }

    Object.assign(webpackConfigs[0], {
      plugins: orderedPlugins.concat(webpackConfigs[0].plugins),
    });

    // Remove properties added during page appliance
    // Additional attributes are not allowed by the webpack config validator
    const frontendConfig = _.omit(webpackConfigs[0], [
      'commonChunks',
    ]);

    const finalConfigs = [frontendConfig].concat(webpackConfigs.slice(1));
    this.webpackConfigs = finalConfigs;

    this.log.debug('Generated Webpack Config', {
      conf: _.pick(finalConfigs[0], [
        'entry', 'includePaths', 'resolve', 'module',
      ]),
    });

    return { pages, webpackConfigs: finalConfigs };
  });
}

/**
 * Runs the webpack compiler(s) for the given configurations
 */
function compile(webpackConfigs) {
  return Promise.resolve().then(() => {
    this.log.start('Compiling');

    if (!this.compiler) {
      // TODO: handle multi configs
      this.compiler = webpack(webpackConfigs[0]);
    }

    if (this.compilerIsRunning !== true) {
      this.compilerIsRunning = true;
      return new Promise((resolve, reject) => this.compiler.run((err, stats) => {
        this.compilerIsRunning = false;
        if (err) {
          reject(err);
          return;
        }

        // TODO: handle webpack@2 stats errors/warnings correctly

        const jsonStats = stats.toJson();

        if (jsonStats.errors.length > 0) {
          this.nextCompilationScheduled = false;
          this.log.warn(`!!! Webpack errors ${jsonStats.errors[0]}`);
          reject(new Error(JSON.stringify(jsonStats.errors[0])));
          return;
        }

        const warnings = stats.compilation
          ? stats.compilation.warnings
          : jsonStats.warnings;

        if (warnings && warnings.length > 0) {
          this.log.warn('!!! Webpack warnings', warnings
            .map((warning) => warning.split('\\n').join('\n')).join('\n'));
        }

        this.log.success('Webpack done.', null, stats);

        // TODO: handle scheduling outside of compile
        if (this.nextCompilationScheduled === true) {
          this.nextCompilationScheduled = false;
          this.log.info('Running next scheduled compilation');
          resolve(this.compile(this.webpackConfigs));
          return;
        }

        this.webpackStats = stats;

        resolve([stats]);
      }));
    }

    this.nextCompilationScheduled = true;
    this.log.info('Webpack already running, next compilation scheduled.');
    return null;
  });
}

module.exports = {
  generateWebpackConfig,
  compile,
};
