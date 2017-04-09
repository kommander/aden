const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const DEV_ENV = process.env.NODE_ENV === 'development';

// TODO: add something like addPageToWebpackConfig(page)
// (reducing applyPageOnWebpack && updatePageConfig)

function generateWebpackConfig(loadedPages) {
  return Promise.resolve(loadedPages).then((pages) => {
    this.logger.start('Generating webpack config');

    const rootPage = pages[0];

    const paths = {
      distPath: path.resolve(rootPage.dist, 'public'),
      node_modules: path.resolve(rootPage.path, 'node_modules'),
      aden_node_modules: path.resolve(__dirname, '../node_modules'),
      aden: path.resolve(__dirname, '../'),
    };

    const includePaths = [
      path.resolve(process.cwd(), 'node_modules'),
      path.resolve(rootPage.path, '../node_modules'),
      path.resolve(rootPage.path, '../../node_modules'),
      rootPage.path,
      paths.aden,
      paths.node_modules,
      rootPage.sharedPath,
    ];

    if (rootPage.useDefaults === true) {
      includePaths.push(rootPage.defaults);
    }

    this.logger.debug(`Setting up paths ${JSON.stringify(paths)}`);

    // TODO: Prepare for webpack@2
    // TODO: Straighten out paths (practically random what is included)

    const generatedConfig = {
      target: 'web',
      entry: {
        // Entries are added per page by aden
      },
      // TODO: Use id and hash only based setup for production
      output: {
        path: paths.distPath,
        publicPath: this.rootConfig.publicPath,
      },
      context: rootPage.path,
      resolve: {
        extensions: ['', '.js', '.css', '.html'],
        root: [
          rootPage.path,
          paths.aden,
          rootPage.sharedPath,
        ],
        fallback: paths.aden_node_modules,
      },
      resolveLoader: {
        root: [
          paths.aden_node_modules,
          paths.node_modules,
        ],
      },
      module: {
        noParse: [
          /\.git/, /\.dist/,
          paths.distPath,
        ],
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
          // TODO: Make sure assets are served at the basePath with assetSubPath (!?)
          //       Why are images (svg) sometimes working and sometimes not (extract text plugin?)?
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
    };

    // Plugins
    const chunks = this.reducePages(pages)
      .map((page) => page.entryName);

    generatedConfig.plugins = [
      new webpack.optimize.OccurrenceOrderPlugin(),
      new webpack.optimize.CommonsChunkPlugin({
        name: 'commons',
        filename: 'commons.js',
        chunks,
        minChunks: 2,
      }),
      new ExtractTextPlugin('[name]-[hash].css', { allChunks: true }),
    ];

    // Output
    // Keep in sync with page build info
    if (DEV_ENV) {
      generatedConfig.output = Object.assign(generatedConfig.output, {
        filename: '[name].js',
        chunkFilename: '[id].chunk.js',
        sourceMapFilename: '[name].map',
      });
    } else {
      generatedConfig.output = Object.assign(generatedConfig.output, {
        filename: '[name].js',
        chunkFilename: '[id].chunk.js',
        sourceMapFilename: '[name].map',
      });
    }

    // Add loaders from pages
    // TODO: use map
    // TODO: Ensure include paths are relative to app, extend with generated include paths
    for (let i = 0; i < this.pageWebpackLoaders.length; i++) {
      const loader = this.pageWebpackLoaders[i];

      if (!Array.isArray(loader.exclude)) {
        loader.exclude = loader.exclude ? [loader.exclude] : [];
      }
      loader.exclude.push(paths.aden);
      generatedConfig.module.loaders.push(loader);
    }

    // TODO: (must) Load custom plugins from app folder,
    //       initialize them with aden object & paths and append

    generatedConfig.plugins.push(new webpack.DefinePlugin({
      __DEV__: DEV_ENV,
      __PROD__: process.env.NODE_ENV === 'production' ? 'true' : 'false',
      __TEST__: process.env.NODE_ENV === 'test' ? 'true' : 'false',
      __ENV__: process.env.NODE_ENV,
    }));

    if (DEV_ENV) {
      generatedConfig.debug = true;
      generatedConfig.cache = false;
      generatedConfig.plugins.push(new HotModuleReplacementPlugin());
    }

    if (process.env.NODE_ENV === 'production') {
      generatedConfig.plugins.push(new webpack.optimize.UglifyJsPlugin());
    }

    this.webpackConfig = generatedConfig;

    return { pages, webpackConfig: generatedConfig };
  })
  .then(({ pages, webpackConfig }) => this.updatePageConfigs(pages, webpackConfig))
  .then(({ pages, webpackConfig }) => ({ pages, webpackConfig }));
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

        if (jsonStats.warnings.length > 0) {
          this.logger.warn('!!! Webpack warnings', jsonStats.warnings);
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
