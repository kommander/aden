const path = require('path');

module.exports = (aden) => {
  aden.registerKey({
    name: 'js',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'jsFile',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.(js|jsx)$/, ({ page, fileInfo }) => {
    if (fileInfo.name === page.js) {
      return Object.assign(page, {
        jsFile: fileInfo.rpath,
      });
    }

    return page;
  });

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
