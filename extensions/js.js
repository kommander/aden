const path = require('path');

module.exports = (aden) => {
  aden.registerKey('js', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile('jsFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.(js|jsx)$/) && fileInfo.name === page.key.js.value
  );

  aden.hook('post:apply', ({ pages, webpackConfigs, paths }) => {
    const flatPages = aden.flattenPages(pages);
    const includePaths = [
      pages[0].rootPath,
      path.resolve(pages[0].rootPath, 'node_modules'),
      path.resolve(pages[0].rootPath, '../node_modules'),
      path.resolve(pages[0].rootPath, '../../node_modules'),
      paths.aden_node_modules,
    ]
    .concat(flatPages.map((page) => page.key.path.resolved));

    webpackConfigs.forEach((config) => {
      config.module.loaders.push({
        test: /\.js$/,
        include: [
          pages[0].rootPath,
        ],
        loaders: [],
      }, {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        include: [
          pages[0].rootPath,
        ],
        exclude: /node_modules/,
      }, {
        test: /\.json$/,
        loader: 'json-loader',
        include: includePaths,
      });
    });
  });

  // TODO: on-board babel again by default
  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.key.jsFile.value) {
      webpackEntry.push(page.key.jsFile.resolved);
    }
  });

  return {
    key: 'js',
    version: '0.2.0',
  };
};