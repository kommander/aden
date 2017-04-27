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

  aden.hook('post:apply', ({ pages, webpackConfigs }) => {
    webpackConfigs.forEach((config) => {
      config.module.rules.push({
        test: /\.jsx?$/,
        loader: require.resolve('babel-loader'),
        include: [
          pages[0].rootPath,
        ],
        exclude: /node_modules/,
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
