const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const _ = require('lodash');

// TODO: add something like addPageToWebpackConfig(page)
// (reducing applyPageOnWebpack && updatePageConfig)

function generateWebpackConfig(loadedPages) {
  this.logger.start('Generating webpack config');

  return Promise.resolve({
    pages: loadedPages,
    webpackConfig: {},
  })
  .then(({ pages, webpackConfig }) => {
    const rootPage = pages[0];

    const paths = {
      distPath: path.resolve(rootPage.resolved.dist, 'public'),
      aden_node_modules: path.resolve(__dirname, '../node_modules'),
      aden: path.resolve(__dirname, '../'),
    };

    this.logger.debug(`Setting up paths ${JSON.stringify(paths)}`);

    // TODO: Prepare for webpack@2

    const includePaths = [
      path.resolve(process.cwd(), 'node_modules'),
      paths.aden,
      paths.aden_node_modules,
    ];

    if (rootPage.useDefaults === true) {
      includePaths.push(rootPage.resolved.defaults);
    }

    _.merge(webpackConfig, {
      includePaths,
      target: 'web',
      entry: {
        // Entries are added per page by aden
      },
      // TODO: Use id and hash only based setup for production
      output: {
        path: paths.distPath,
        publicPath: this.rootConfig.publicPath,
      },
      context: rootPage.resolved.path,
      resolve: {
        extensions: ['', '.js', '.css', '.html'],
        root: [],
        fallback: paths.aden_node_modules,
      },
      resolveLoader: {
        root: [
          paths.aden_node_modules,
        ],
      },
      plugins: [],
    });

    return { pages, webpackConfig, paths };
  })
  .then(({ pages, webpackConfig, paths }) =>
    this.walkPages(pages, webpackConfig, null, null, (page, config) => {
      this.logger.debug('Applying page to webpackConfig', {
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
          `webpack-hot-middleware/client?reload=true&path=${this.config.hmrPath}`);
      }

      return Promise.resolve({ webpackConfig, page, webpackEntry })
        .then(args => {
          const entry = args.webpackEntry;

          // Provide template with bundle
          // TODO: Only include template with bundle optionally,
          //       just included now to trigger a browser reload when template is changed
          if (page.template) { // && page.bundleTemplate === true) {
            entry.push(page.template);
          }

          page.entry = entry;

          if (entry) {
            const entryName = page.entryName;
            config.entry[entryName] = webpackEntry;
          }

          _.merge(config, {
            includePaths: config.includePaths.concat([
              page.resolved.path,
              page.resolved.shared,
              path.resolve(page.resolved.path, 'node_modules'),
              path.resolve(page.resolved.path, '../node_modules'),
              path.resolve(page.resolved.path, '../../node_modules'),
            ]),
            resolve: {
              root: config.resolve.root.concat([
                page.resolved.path,
                page.resolved.shared,
                path.resolve(page.resolved.path, '../node_modules'),
                path.resolve(page.resolved.path, '../../node_modules'),
              ]),
            },
          });

          return args;
        })
        .then((args) => this.applyHook('apply', args));
    })
    .then(() => ({ pages, webpackConfig, paths }))
  )
  .then(({ pages, webpackConfig, paths }) => {
    const includePaths = webpackConfig.includePaths;

    // DEV: Apply page plugins to existing compiler
    if (this.compiler) {
      webpackConfig.plugins.forEach((plugin) =>
        this.compiler.apply(plugin));
    }

    _.merge(webpackConfig, {
      module: {
        noParse: [
          /\.git/, /\.dist/,
        ],
        // TODO: move default loaders to their extensions
        loaders: [
          {
            test: /\.js$/,
            include: includePaths,
            loaders: [],
          },
          {
            test: /\.css$/,
            include: includePaths,
            loader: ExtractTextPlugin.extract('style-loader', 'css-loader'),
            // loaders: ['style-loader', 'css-loader'],
          },
          {
            test: /\.html$/,
            include: includePaths,
            loader: 'html?attrs[]=img:src&attrs[]=link:href',
          },
          {
            test: /\.(mustache|hbs|handlebars)$/,
            include: includePaths,
            loader: 'mustache',
          },
          {
            test: /\.(png|svg|jpg|jpeg|gif)?$/,
            include: includePaths,
            loader: 'file?name=images/[name]-[sha512:hash:base64:7].[ext]',
          },
          {
            test: /\.(eot)(\?v=[0-9]\.[0-9]\.[0-9])?$|\.(svg)\?v=[0-9]\.[0-9]\.[0-9]?$/,
            include: includePaths,
            loader: 'url?limit=50000&mimetype=application/eot',
          },
          {
            test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            include: includePaths,
            loader: 'url?limit=50000&mimetype=application/font-woff',
          },
          {
            test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
            include: includePaths,
            loader: 'url?limit=50000&mimetype=application/octet-stream',
          },
        ],
      },
    });

    // Plugins
    const chunks = this.flattenPages(pages)
      .map((page) => page.entryName);

    webpackConfig.plugins.push(
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'commons',
        filename: 'commons.js',
        chunks,
        minChunks: 2,
      }),
      new ExtractTextPlugin('[name]-[hash].css', { allChunks: true })
    );

    // Output
    // Keep in sync with page build info
    if (this.isDEV) {
      Object.assign(webpackConfig, {
        output: Object.assign(webpackConfig.output, {
          filename: '[name].js',
          chunkFilename: '[id].chunk.js',
          sourceMapFilename: '[name].map',
        }),
      });
    } else {
      Object.assign(webpackConfig, {
        output: Object.assign(webpackConfig.output, {
          filename: '[name].js',
          chunkFilename: '[id].chunk.js',
          sourceMapFilename: '[name].map',
        }),
      });
    }

    // Add loaders from pages
    // TODO: use map
    // TODO: Ensure include paths are relative to app
    // TODO: if no includePaths, use default includePaths
    // TODO: extend include paths with
    //       use webpack: { ... } in .aden and override here with _.extend()
    //       except for loaders/plugins, which are merged with default plugins
    for (let i = 0; i < this.pageWebpackLoaders.length; i++) {
      const loader = this.pageWebpackLoaders[i];

      if (!Array.isArray(loader.exclude)) {
        loader.exclude = loader.exclude ? [loader.exclude] : [];
      }
      loader.exclude.push(paths.aden);
      webpackConfig.module.loaders.push(loader);
    }

    // TODO: (must) Load custom plugins from app folder,
    //       initialize them with aden object & paths and append

    webpackConfig.plugins.push(new webpack.DefinePlugin({
      __DEV__: this.isDEV,
      __PROD__: this.isPROD ? 'true' : 'false',
      __TEST__: process.env.NODE_ENV === 'test' ? 'true' : 'false',
      __ENV__: this.isDEV,
    }));

    if (this.isDEV) {
      Object.assign(webpackConfig, {
        debug: true,
        cache: false,
      });
      webpackConfig.plugins.push(new HotModuleReplacementPlugin());
    }

    if (this.isPROD) {
      webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin());
    }

    this.webpackConfig = webpackConfig;

    this.logger.debug('Generated Webpack Config', _.pick(webpackConfig, [
      'entry', 'includePaths', 'resolve',
    ]));

    return { pages, webpackConfig };
  });
}

// TODO: >> Reduce available webpack config to loaders/plugins (inherited and overridden per page)
//       >> using page local node_modules first,
//          then root node_modules and aden node_modules as fallback
function compile(webpackConfig) {
  return Promise.resolve().then(() => {
    this.logger.start('Compiling');

    if (!this.compiler) {
      this.compiler = webpack(webpackConfig);
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
          this.logger.warn(`!!! Webpack errors ${jsonStats.errors[0]}`,
            jsonStats.errors, webpackConfig);
          reject(new Error(JSON.stringify(jsonStats.errors)));
          return;
        }

        if (stats.compilation.warnings.length > 0) {
          this.logger.warn('!!! Webpack warnings', stats.compilation.warnings);
        }

        this.logger.success(`Webpack done in ${stats.endTime - stats.startTime}ms`, null, stats);

        // TODO: handle scheduling outside of compile
        if (this.nextCompilationScheduled === true) {
          this.nextCompilationScheduled = false;
          this.logger.info('Running next scheduled compilation');
          resolve(this.compile(this.webpackConfig));
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
