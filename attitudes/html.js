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

  // TODO: Warn for overlapping static dist files like: [index.md, index.hbs] -> index.html

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
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push('.html');

    frontendConfig.module.rules.push({
      test: /\.html$/,
      include: [
        path.resolve(pages[0].rootPath, '../node_modules'),
        path.resolve(pages[0].rootPath, '../../node_modules'),
      ].concat(aden.flattenPages(pages).map((page) => page.key.path.resolved)),
      use: {
        loader: require.resolve('html-loader'),
        // options: {
        //   minimize: !aden.isDEV,
        // },
      },
    });
  });
};
