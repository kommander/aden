const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');

module.exports = (aden) => {
  aden.registerKey('css', {
    type: 'custom',
    config: true,
    value: {
      entry: 'index',
    },
    inherit: true,
  });

  // TODO: Let an attitude add to ignores (css -> css/style, js -> lib/components/...)

  aden.registerFile('cssFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.(css|scss)$/) && fileInfo.name === page.css.value.entry
  );

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.cssFile.value) {
      webpackEntry.push(page.cssFile.resolved);
    }
  });

  aden.hook('post:apply', ({ webpackConfigs, paths }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push('.css', '.scss', '.sass');

    const extractCSSPlugin = new ExtractTextPlugin({
      filename: aden.isDEV ? '[name].css' : '[id]-[hash].css',
      allChunks: true,
    });
    frontendConfig.plugins.push(extractCSSPlugin);

    const extractSCSSPlugin = new ExtractTextPlugin({
      filename: aden.isDEV ? '[name].css' : '[id]-[hash].css',
      allChunks: true,
    });
    frontendConfig.plugins.push(extractSCSSPlugin);

    const includePaths = [
      aden.rootPath,
      path.resolve(aden.rootPath, 'node_modules'),
      path.resolve(aden.rootPath, '../node_modules'),
      path.resolve(aden.rootPath, '../../node_modules'),
      paths.aden_node_modules,
    ];

    frontendConfig.module.rules.unshift(
      {
        test: /\.css$/,
        use: extractCSSPlugin.extract({
          fallback: require.resolve('style-loader'),
          use: [require.resolve('css-loader')],
          allChunks: true,
        }),
      },
      {
        test: /\.scss$/,
        use: extractSCSSPlugin.extract({
          fallback: require.resolve('style-loader'),
          // resolve-url-loader may be chained before sass-loader if necessary
          use: [require.resolve('css-loader'), require.resolve('sass-loader')],
          allChunks: true,
        }),
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|ico)?$/,
        include: includePaths,
        use: {
          loader: require.resolve('file-loader'),
          options: {
            name: aden.isDEV
              ? 'images/[name].[ext]'
              : 'images/[sha512:hash:base64:7].[ext]',
          },
        },
      },
      {
        test: /\.(eot)(\?v=[0-9]\.[0-9]\.[0-9])?$|\.(svg)\?v=[0-9]\.[0-9]\.[0-9]?$/,
        include: includePaths,
        loader: require.resolve('url-loader'),
        options: {
          limit: 50000,
          mimetype: 'application/eot',
        },
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        include: includePaths,
        loader: require.resolve('url-loader'),
        options: {
          limit: 50000,
          mimetype: 'application/font-woff',
        },
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        include: includePaths,
        loader: require.resolve('url-loader'),
        options: {
          limit: 50000,
          mimetype: 'application/octet-stream',
        },
      }
    );
  });
};
