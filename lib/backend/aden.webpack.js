const path = require('path');
const webpack = require('webpack');
const HotModuleReplacementPlugin = webpack.HotModuleReplacementPlugin;
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const DEV_ENV = process.env.NODE_ENV === 'development';

function generateWebpackConfig(pages) {
  return Promise.resolve().then(() => {
    this.logger.start('Generating webpack config');

    const paths = {
      distPath: path.resolve(this.rootPage.dist, 'public'),
      node_modules: path.resolve(this.rootPage.path, 'node_modules'),
      aden_node_modules: path.resolve(__dirname, '../../node_modules'),
      aden: path.resolve(__dirname, '../../'),
    };

    const includePaths = [
      this.rootPage.path,
      paths.aden,
      paths.node_modules,
      this.rootPage.sharedPath,
    ];

    if (this.rootPage.useDefaults === true) {
      includePaths.push(this.rootPage.defaults);
    }

    this.logger.debug(`Setting up paths ${JSON.stringify(paths)}`);

    // TODO: Export a config array, with a separate config per page,
    // so loaders are only applied to a page and its children (if not configured otherwise)
    // TODO: Prepare for webpack@2

    const webpackConfig = {
      target: 'web',
      entry: {
        // Entries are added per page by aden
      },
      // TODO: Use id and hash only based setup for production
      output: {
        filename: '[name].js',
        chunkFilename: '[id].chunk.js',
        sourceMapFilename: '[name].map',
        path: paths.distPath,
        publicPath: this.rootPage.basePath,
      },
      context: this.rootPage.path,
      resolve: {
        extensions: ['', '.js', '.css', '.html'],
        root: [
          this.rootPage.path,
          paths.aden,
          this.rootPage.sharedPath,
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
        preLoaders: [
          // {
          //   test: /\.js$/,
          //   include: includePaths,
          //   loader: 'source-map-loader',
          // },
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
          // TODO: Make sure assets are served at the basePath with assetSubPath
          {
            test: /\.(png|svg|jpg|jpeg|gif)?$/,
            include: includePaths,
            loader: 'file?name=images/[name]-[sha512:hash:base64:7].[ext]',
          },
          {
            test: /\.(eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            include: paths.node_modules,
            loader: 'url',
          },
          {
            test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            include: includePaths,
            loader: 'url?limit=50000&mimetype=application/font-woff',
          },
          {
            test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
            include: includePaths,
            loader: 'url?limit=10000&mimetype=application/octet-stream',
          },

        ],
      },
      plugins: [
        new webpack.optimize.CommonsChunkPlugin({
          name: 'commons',
          filename: 'commons.js',
        }),
        new ExtractTextPlugin('[name]-[hash].css', { allChunks: true }),
      ],
    };

    // Add loaders from pages
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
      __DEV__: DEV_ENV,
      __PROD__: process.env.NODE_ENV === 'production' ? 'true' : 'false',
      __TEST__: process.env.NODE_ENV === 'test' ? 'true' : 'false',
      __ENV__: process.env.NODE_ENV,
    }));

    if (DEV_ENV) {
      webpackConfig.debug = true;
      webpackConfig.cache = false;
      webpackConfig.plugins.push(new HotModuleReplacementPlugin());
    }

    if (process.env.NODE_ENV === 'production') {
      webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin());
    }

    this.webpackConfig = webpackConfig;

    return this.updatePageConfigs(pages).then(() => this.webpackConfig);
  });
}

// TODO: we can have a compiler per entry point, aka page/module, so page.compile() should do,
//       or aden.compile(page)
//       >> Align with cross page commons (use externals and gather all .shared as commons per page)
//          (Having .shared as commons we can spot duplications easily through out a page tree)
//       >> Commons should preferably be npm modules, so each page works standalone,
//          but shared modules can be brought down to the root path level
//       >> Inherit commons from parentPage
//       >> Have non recursive watchers per page and compiler
//       >> Reduce needed webpack config to loaders (inherited and overridden per page)
//       >> use page local node_modules first,
//          then root node_modules and aden node_modules as fallback
//       >> Run compiler only if something in page path changed, or in module/shared folders
//       >> use this setup to allo --focus /base/path/sub/page1
//          to run a dedicated instance for a page (and dedicated compiler processes)
function compile() {
  return new Promise((resolve, reject) => {
    try {
      if (!this.compiler) {
        this.compiler = webpack(this.webpackConfig);
      }
    } catch (ex) {
      this.logger.warn('!!! Webpack compiler setup failed.', {
        pages: this.pages, webpackConfig: this.webpackConfig,
      }, ex);
      reject(ex);
      return;
    }

    if (!this.compilerIsRunning === true) {
      this.compilerIsRunning = true;
      this.compiler.run((err, stats) => {
        this.compilerIsRunning = false;
        if (err) {
          this.logger.debug('!!! Compiler failed.', {}, err);
          reject(err);
          return;
        }

        const jsonStats = stats.toJson();
        if (jsonStats.errors.length > 0) {
          this.nextCompilationScheduled = false;
          this.logger.warn(`!!! Webpack errors ${jsonStats.errors[0]}`,
            jsonStats.errors, this.webpackConfig);
          reject(new Error(JSON.stringify(jsonStats.errors)));
          return;
        }

        if (jsonStats.warnings.length > 0) {
          this.logger.warn('!!! Webpack warnings', jsonStats.warnings);
        }

        this.logger.success(`Webpack done in ${stats.endTime - stats.startTime}ms`);

        if (this.nextCompilationScheduled === true) {
          this.nextCompilationScheduled = false;
          this.logger.info('Running next scheduled compilation');
          resolve(this.compile());
          return;
        }

        resolve();
      });
    } else {
      this.nextCompilationScheduled = true;
      this.logger.info('Webpack already running, next compilation scheduled.');
    }
  });
}

module.exports = {
  generateWebpackConfig,
  compile,
};
