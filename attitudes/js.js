const fs = require('fs');
const path = require('path');

module.exports = (aden) => {
  aden.registerKey('js', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile('jsFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.(js|jsx)$/) && fileInfo.name === page.js.value
  );

  aden.hook('post:apply', ({ webpackConfigs }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push('.js', '.jsx');

    const options = {
      highlightCode: false,
    };

    const rootBabel = path.resolve(aden.rootPath, '.babelrc');
    try {
      // No default presets, because it takes precedence over .babelrc
      // If there's a switch to let .babelrc take precedence, defaults would be nice.
      fs.accessSync(rootBabel, fs.F_OK | fs.R_OK);
    } catch(ex) {
      Object.assign(options, {
        presets: [
          require.resolve('babel-preset-es2015'),
        ],
      });
    }

    // on-board babel by default
    webpackConfigs.forEach((config) => {
      config.module.rules.push({
        test: /\.jsx?$/,
        use: {
          loader: require.resolve('babel-loader'),
          options,
        },
        include: [
          aden.rootPath,
        ],
        exclude: /node_modules/,
      });
    });
  });

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.jsFile.value) {
      webpackEntry.push(page.jsFile.resolved);
    }
  });
};
