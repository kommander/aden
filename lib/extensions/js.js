const path = require('path');

module.exports = (aden) => {
  aden.registerKey('js', {
    type: 'string',
    value: 'index',
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile('jsFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.(js|jsx)$/) && fileInfo.name === page.js
  );

  // TODO: on-board babel again by default
  aden.hook('apply', ({ page, webpackEntry, webpackConfig }) => {
    if (page.jsFile) {
      webpackEntry.push(page.resolved.jsFile);

      webpackConfig.module.loaders.push({
        test: /\.js$/,
        include: [
          page.resolved.path,
          path.resolve(page.resolved.path, 'node_modules'),
          path.resolve(page.resolved.path, '../node_modules'),
          path.resolve(page.resolved.path, '../../node_modules'),
          path.resolve(page.rootPath, 'node_modules'),
        ],
        loaders: [],
      });
    }
  });

  return {
    key: 'js',
    version: '0.1.0',
  };
};
