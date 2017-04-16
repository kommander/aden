const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');

module.exports = (aden) => {
  aden.registerKey('css', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  aden.registerFile('cssFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.css$/) && fileInfo.name === page.key.css.value
  );

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.key.cssFile.value) {
      webpackEntry.push(page.key.cssFile.resolved);
    }
  });

  aden.hook('post:apply', ({ pages, webpackConfig }) => {
    const extractPlugin = new ExtractTextPlugin('[name]-[hash].css', { allChunks: true });
    webpackConfig.plugins.push(extractPlugin);

    const includePaths = [
      pages[0].rootPath,
      path.resolve(pages[0].rootPath, 'node_modules'),
    ];

    webpackConfig.module.loaders.push(
      {
        test: /\.css$/,
        include: includePaths,
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader'),
        // loaders: ['style-loader', 'css-loader'],
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
      }
    );
  });

  return {
    key: 'css',
    version: '0.1.0',
  };
};
