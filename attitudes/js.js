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
    webpackConfigs[0].resolve.extensions.push('.js', '.jsx');

    // on-board babel by default
    webpackConfigs.forEach((config) => {
      config.module.rules.push({
        test: /\.jsx?$/,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              require.resolve('babel-preset-env'),
              require.resolve('babel-preset-es2015'),
            ],
          },
        },
        include: [
          pages[0].rootPath,
        ],
        exclude: /node_modules/,
      });
    });
  });

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.key.jsFile.value) {
      webpackEntry.push(page.key.jsFile.resolved);
    }
  });
};
