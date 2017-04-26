const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');

module.exports = (aden) => {
  aden.registerKey('css', {
    type: 'config',
    value: {
      entry: 'index',
      global: 'base',
    },
    inherit: true,
  });

  aden.registerKey('hasBaseFile', {
    type: 'rpath',
    value: false,
    inherit: true,
  });

  // TODO: Gather all css files in page path and add them to the bundle
  // TODO: Let an extension add to ignores (css -> css/style, js -> lib/components/...)

  aden.registerFile('cssFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.css|\.scss$/) && fileInfo.name === page.key.css.value.entry
  );

  aden.registerFile('cssBaseFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.css|\.scss$/)
      && page.key.path.value === ''
      && fileInfo.name === page.key.css.value.global
      && page.key.hasBaseFile.value === false
  , {
    fn: ({ page, fileInfo }) =>
      Object.assign(page.key.hasBaseFile, {
        value: fileInfo.rpath,
      }),
  });

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.key.hasBaseFile.value) {
      webpackEntry.push(page.key.hasBaseFile.resolved);
    }
    if (page.key.cssFile.value) {
      console.log('cssfile', page.key.cssFile.resolved);
      webpackEntry.push(page.key.cssFile.resolved);
    }
  });

  aden.hook('post:apply', ({ pages, webpackConfigs, paths }) => {
    const extractCSSPlugin = new ExtractTextPlugin({
      filename: aden.isDEV ? '[name].css' : '[id]-[hash].css',
      allChunks: true,
    });
    webpackConfigs[0].plugins.push(extractCSSPlugin);

    const extractSCSSPlugin = new ExtractTextPlugin({
      filename: aden.isDEV ? '[name].scss.css' : '[id]-[hash].css',
      allChunks: true,
    });
    webpackConfigs[0].plugins.push(extractSCSSPlugin);

    const includePaths = [
      pages[0].rootPath,
      path.resolve(pages[0].rootPath, 'node_modules'),
      path.resolve(pages[0].rootPath, '../node_modules'),
      path.resolve(pages[0].rootPath, '../../node_modules'),
      paths.aden_node_modules,
    ];

    webpackConfigs[0].module.rules.push(
      {
        test: /\.css|\.scss$/,
        include: includePaths,
        loader: extractCSSPlugin.extract({
          fallback: require.resolve('style-loader'),
          // use: require.resolve('css-loader'),
          use: [require.resolve('css-loader'), require.resolve('sass-loader')],
          // publicPath (?)
        }),
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)?$/,
        include: includePaths,
        loader: require.resolve('file-loader'),
        options: {
          name: 'images/[name]-[sha512:hash:base64:7].[ext]',
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

  return {
    key: 'css',
    version: '0.2.1',
  };
};
