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

  // TODO: Gather all css files in page path and add them to the bundle
  // TODO: Let an extension add to ingores (css -> css/style, js -> lib/components/...)

  aden.registerFile('cssFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.css$/) && fileInfo.name === page.key.css.value.entry
  );

  aden.registerFile('cssBaseFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.css$/)
      && page.key.path.value === ''
      && fileInfo.name === page.key.css.value.global
  );

  aden.hook('apply', ({ page, webpackEntry, webpackConfigs }) => {
    if (page.key.cssFile.value) {
      webpackEntry.push(page.key.cssFile.resolved);
    }
    if (page.key.cssBaseFile.value) {
      Object.assign(webpackConfigs[0].entry, {
        _cssBase: page.key.cssBaseFile.value,
      });
      webpackConfigs[0].globalChunks.push('_cssBase');
    }
  });

  aden.hook('post:apply', ({ pages, webpackConfigs, paths }) => {
    const outputName = aden.isDEV ? '[name].css' : '[name]-[hash].css';
    const extractPlugin = new ExtractTextPlugin({
      filename: outputName,
      allChunks: true,
    });
    webpackConfigs[0].plugins.push(extractPlugin);

    const includePaths = [
      pages[0].rootPath,
      path.resolve(pages[0].rootPath, 'node_modules'),
      path.resolve(pages[0].rootPath, '../node_modules'),
      path.resolve(pages[0].rootPath, '../../node_modules'),
      paths.aden_node_modules,
    ];

    webpackConfigs[0].module.rules.push(
      {
        test: /\.css$/,
        include: includePaths,
        loader: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader',
          // publicPath (?)
        }),
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)?$/,
        include: includePaths,
        loader: 'file-loader?name=images/[name]-[sha512:hash:base64:7].[ext]',
      },
      {
        test: /\.(eot)(\?v=[0-9]\.[0-9]\.[0-9])?$|\.(svg)\?v=[0-9]\.[0-9]\.[0-9]?$/,
        include: includePaths,
        loader: 'url-loader?limit=50000&mimetype=application/eot',
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        include: includePaths,
        loader: 'url-loader?limit=50000&mimetype=application/font-woff',
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        include: includePaths,
        loader: 'url-loader?limit=50000&mimetype=application/octet-stream',
      }
    );
  });

  return {
    key: 'css',
    version: '0.2.1',
  };
};
