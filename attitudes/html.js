const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = (aden) => {
  const {
    ENTRY_TYPE_STATIC,
  } = aden.constants;

  aden.registerKey('html', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  aden.registerFile(
    'htmlFile',
    ({ page, fileInfo }) =>
      fileInfo.file.match(/\.html$/) && fileInfo.name === page.key.html.value,
    {
      entry: ENTRY_TYPE_STATIC,
      distExt: '.html',
    }
  );

  aden.hook('post:apply', ({ pages, webpackConfigs }) => {
    webpackConfigs[0].resolve.extensions.push('.html');

    webpackConfigs[0].module.rules.push({
      test: /\.html$/,
      include: [
        path.resolve(pages[0].rootPath, '../node_modules'),
        path.resolve(pages[0].rootPath, '../../node_modules'),
      ].concat(aden.flattenPages(pages).map((page) => page.key.path.resolved)),
      use: {
        loader: require.resolve('html-loader'),
        // options: {
        //   minimize: aden.isPROD,
        // },
      },
    });
  });
};
