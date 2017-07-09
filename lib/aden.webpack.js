'use strict';

const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const _ = require('lodash');
const webpackMerge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlIncludeAssets = require('html-webpack-include-assets-plugin');

const {
  ENTRY_STATIC,
  ENTRY_DYNAMIC,
  KEY_FILE,
  KEY_FILE_ARRAY,
  KEY_RPATH,
} = require('./aden.constants');

function generateWebpackConfig(loadedPages) {
  this.log.start('Generating webpack config');

  // Reset watch keys as they will get added when iterating over pages
  this.watchKeys = [];

  // Generate base configs
  return Promise.resolve({
    pages: loadedPages,
    webpackConfigs: [
      {
        name: 'frontend',
        entry: {
          // Entries are added per page by aden
        },
      },
    ],
  })
  .then(({ pages, webpackConfigs }) => {
    const paths = {
      distPath: path.resolve(this.settings.dist, 'public'),
      aden_node_modules: path.resolve(__dirname, '../node_modules'),
      aden: path.resolve(__dirname, '../'),
    };

    this.log.debug(`Setting up paths ${JSON.stringify(paths)}`);

    _.merge(webpackConfigs[0], {
      target: 'web',
      // Uses id and hash only based setup for production
      output: {
        path: paths.distPath,
        publicPath: this.settings.publicPath,
      },
      context: this.rootPath,
      resolve: {
        alias: {},
        extensions: [],
        modules: [
          paths.aden_node_modules,
          // Need to resolve to peer deps when aden is installed as dep
          path.resolve(paths.aden_node_modules, '../../../node_modules'),
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
  .then((args) => this.applyHook('pre:apply', args))
  // Apply pages
  .then(({ pages, webpackConfigs, paths }) =>
    this.walkPages(pages, (page) => {
      this.log.info(`Applying page ${page.relativePath} to webpackConfigs`);

      if (page.createEntry === false) {
        return page;
      }

      // Push client entry point to beginning
      const webpackEntry = [];

      if (page.entry.value.length > 0) {
        page.entry.resolved.forEach((val) => webpackEntry.push(val));
      }

      return Promise.resolve({ webpackConfigs, page, webpackEntry, paths })
        .then((args) => {
          webpackConfigs.forEach((webpackConfig) =>
            this.applyPagePathsToConfig(webpackConfig, args.page)
          );

          // Gather keys to consider in file watcher
          Array.prototype.push.apply(this.watchKeys, args.page.keys
            .filter((key) => (key.watch === true))
          );

          const frontendConfig = webpackConfigs
            .find((conf) => (conf.name === 'frontend'));

          const htmlPluginForKey = (pluginKey, pageScope) => {
            const chunks = ['global', pageScope.entryName];

            if (pageScope.commons) {
              chunks.unshift('commons');
            }

            const htmlPlugin = new HtmlWebpackPlugin({
              template: pluginKey.resolved,
              filename: pluginKey.dist,
              inject: pageScope.inject,
              cache: !this.isDEV,
              chunks,
              showErrors: this.isDEV,
            });

            if (pluginKey.entry === ENTRY_STATIC
              && pluginKey.value.match(/index\.html?/)) {
              pageScope.set('staticMain', pluginKey.name);
            }

            Object.assign(htmlPlugin, {
              pageScope,
            });
            
            return htmlPlugin;
          };

          // Handle entry point keys (STATIC | DYNAMIC)
          const htmlKeys = args.page.keys
            .filter((key) => (
              key.entry === ENTRY_STATIC || key.entry === ENTRY_DYNAMIC
            ))
            .map((key) => {
              if (key.value) {
                if (key.type === KEY_FILE || key.type === KEY_RPATH) {
                  return [key];
                } else if (key.type === KEY_FILE_ARRAY) {
                  return key.value || [];
                }
              }
              return null;
            })
            .filter((key) => !!key)
            .reduce((prev, keys) => prev.concat(keys), []);

          htmlKeys.forEach((key) => {
            const htmlPlugin = htmlPluginForKey(key, args.page);
            frontendConfig.plugins.push(htmlPlugin);
          });

          if (
            args.page.assets.value.length > 0
            && htmlKeys.length > 0
          ) {
            const includeAssets = new HtmlIncludeAssets({
              files: htmlKeys.map((key) =>
                path.relative(
                  path.join(this.settings.dist, page.distSubPath.value || 'public'),
                  key.dist
                )
              ),
              assets: args.page.assets.value,
              append: false,
            });
            frontendConfig.plugins.push(includeAssets);
          }

          return this.applyHook('apply', args)
            .then((hooked) => {
              // Merge webpack config from page .server
              if (typeof hooked.page.webpack.value === 'object') {
                Object.assign(frontendConfig,
                  webpackMerge(frontendConfig, hooked.page.webpack.value));
              }
              
              if (Object.keys(hooked.page.handledFiles).length > 0
                || hooked.page.entry.value.length > 0) {
                if (this.isDEV) {
                  // TODO: move to dev setup as hook
                  hooked.webpackEntry.unshift(
                    `${require.resolve('webpack-hot-middleware/client')}?reload=true&name=frontend&path=${
                      this.rootPage.basePath}${this.settings.hmrPath}`
                  );
                }

                // Push global client to the top
                hooked.webpackEntry.unshift(path.resolve(__dirname, 'client/index.js'));

                Object.assign(frontendConfig, {
                  entry: Object.assign(frontendConfig.entry, {
                    [hooked.page.entryName]: hooked.webpackEntry,
                  }),
                });
              }
              
              return hooked;
            })
            .then((applied) => applied.page);
        });
    })
    .then(() => ({ pages, webpackConfigs, paths }))
    .then((args) => this.applyHook('post:apply', args))
  )
  .then(({ pages, webpackConfigs /* , paths */ }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    // Get plugins in order
    const orderedPlugins = [];

    // Plugins
    const chunks = this.flattenPages(pages)
      .map((page) => page.entryName);

    orderedPlugins.push(
      new webpack.optimize.CommonsChunkPlugin({
        // TODO: hash filename in prod
        name: 'commons',
        filename: 'commons.js',
        chunks,
        minChunks: 2,
      })
    );

    frontendConfig.plugins.push({
      apply: (compiler) => {
        compiler.plugin('compilation', (compilation) => {
          compilation
            .plugin('html-webpack-plugin-before-html-processing',
              (htmlPluginData, callback) => {
                this.applyHook('html', {
                  // TODO: Make pageScope -> pageScopeId and select here
                  // from pagesById instead of referencing
                  page: htmlPluginData.plugin.pageScope,
                  data: htmlPluginData,
                  compilation,
                  compiler,
                })
                .then(({ data }) => callback(null, data))
                .catch((err) => callback(err, htmlPluginData));
              });
        });
      },
    });

    // Output
    // Keep in sync with page build info
    if (this.isDEV) {
      Object.assign(frontendConfig, {
        cache: false,
        output: Object.assign(frontendConfig.output, {
          filename: '[name].js',
          chunkFilename: '[name][id]-[chunkhash].js',
          sourceMapFilename: '[name].map',
        }),
      });
    } else {
      Object.assign(frontendConfig, {
        output: Object.assign(frontendConfig.output, {
          filename: '[name].js',
          chunkFilename: '[name][id]-[chunkhash].js',
        }),
      });
    }

    Object.assign(frontendConfig, {
      plugins: this.getDefaultWebpackPlugins()
        .concat(orderedPlugins)
        .concat(frontendConfig.plugins),
    });

    // Do not build configs without entry
    this.webpackConfigs = webpackConfigs
      .filter((conf) => (Object.keys(conf.entry).length > 0));

    this.log.debug('Generated Webpack Config', webpackConfigs);

    return { pages, webpackConfigs: this.webpackConfigs };
  });
}

function applyPagePathsToConfig(webpackConfig, page) {
  _.merge(webpackConfig, {
    resolve: {
      modules: webpackConfig.resolve.modules.concat([
        page.path.resolved,
        page.shared.resolved,
        path.resolve(page.path.resolved, 'node_modules'),
        path.resolve(page.path.resolved, '../node_modules'),
        path.resolve(page.path.resolved, '../../node_modules'),
      ]),
    },
    module: {
      rules: webpackConfig.module.rules.concat(page.rules.value.map((rule) =>
        Object.assign(rule, {
          include: (rule.include || []).concat([
            this.rootPath,
            page.path.resolved,
            path.resolve(__dirname, '../node_modules'),
            path.resolve(page.path.resolved, 'node_modules'),
            // path.resolve(page.path.resolved, '../node_modules'),
            // path.resolve(page.path.resolved, '../../node_modules'),
          ]),
        })
      )),
    },
  });
}

function getDefaultWebpackPlugins() {
  const orderedPlugins = [];

  // Consider for default:
  // - WatchIgnorePlugin
  // - Externals (webpack-node-externals)

  // TODO: Take env vars from .server (copy over values from process.env for keys spec'd in .server)
  orderedPlugins.push(new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(this.isDEV ? 'development' : 'production'),
  }));

  // TODO: move to dev setup and use hooks
  if (this.isDEV) {
    orderedPlugins.push(new HotModuleReplacementPlugin());
  }

  if (!this.isDEV) {
    orderedPlugins.push(new webpack.optimize.UglifyJsPlugin({
      sourceMap: false,
      minimize: true,
      compress: {
        warnings: false,
      },
    }));
  }

  return orderedPlugins;
}

/**
 * Runs the webpack compiler(s) for the given configurations
 */
function compile(webpackConfigs) {
  return Promise.resolve().then(() => {
    this.log.start('Compiling');

    if (!this.compiler) {
      this.compiler = webpack(webpackConfigs);
    }

    if (this.compilerIsRunning !== true) {
      this.compilerIsRunning = true;

      // For MultiCompiler we need to run one of the child compilers,
      // otherwise it will run two compilations (since version 2 somewhere)
      // const compilerToRun = this.compiler.compilers
      //   ? this.compiler.compilers[0] : this.compiler;

      return new Promise((resolve, reject) => this.compiler.run((err, stats) => {
        this.compilerIsRunning = false;

        if (err) {
          reject(err);
          return;
        }

        // TODO: handle webpack stats errors/warnings correctly (and nice formatting)

        const jsonStats = stats.toJson();

        if (jsonStats.errors.length > 0) {
          this.nextCompilationScheduled = false;
          this.log.event('webpack:build:errors');
          jsonStats.errors.forEach((statErr) => {
            this.log.raw(statErr);
          });
          reject(new Error(JSON.stringify(jsonStats.errors[0])));
          return;
        }

        const warnings = stats.compilation
          ? stats.compilation.warnings
          : jsonStats.warnings;

        if (warnings && warnings.length > 0) {
          this.log.warn('!!! Webpack warnings', warnings);
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
  getDefaultWebpackPlugins,
  applyPagePathsToConfig,
  compile,
};
