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

  // TODO: on-board babel again by default
  aden.hook('apply', ({ page, webpackEntry, webpackConfig }) => {
    if (page.key.jsFile.value) {
      webpackEntry.push(page.key.jsFile.resolved);

      webpackConfig.module.loaders.push({
        test: /\.js$/,
        include: [
          page.key.path.resolved,
          path.resolve(page.key.path.resolved, 'node_modules'),
          path.resolve(page.key.path.resolved, '../node_modules'),
          path.resolve(page.key.path.resolved, '../../node_modules'),
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
