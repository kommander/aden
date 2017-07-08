const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const resolve = require('resolve');

module.exports = (aden) => {
  aden.registerKey('js', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  aden.registerFile('jsFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.(js|jsx)$/) && fileInfo.name === page.js.value
  );

  function resolveDependencies(type, items = []) {
    return items.map((item) => {
      let itemName = Array.isArray(item) ? item[0] : item;

      if (path.isAbsolute(itemName)) {
        return item;
      }

      if (!itemName.match(new RegExp(`babel-${type}-`))) {
        itemName = [`babel-${type}-`, itemName].join('');
      }

      try {
        itemName = resolve.sync(itemName, { basedir: aden.rootPath });
      } catch(ex) {
        aden.log.debug(`${type} not found in app node_modules`, ex);
      }

      try {
        itemName = resolve.sync(itemName, { 
          basedir: path.resolve(__dirname, '../'),
        });
      } catch(ex) {
        aden.log.debug(`${type} not found in aden node_modules`, ex);
      }

      if (Array.isArray(item)) {
        item[0] = itemName;
        return item;
      }

      return itemName;
    });
  }

  aden.hook('post:apply', ({ webpackConfigs }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push('.js', '.jsx');

    const options = {};

    const rootBabels = [
      '.babelrc',
      '.babelrc.js',
    ];

    const babelFiles = aden.checkAccessMulti(aden.rootPath, rootBabels);

    if (babelFiles.length > 0) {
      const babelConfig = aden.loadNativeOrJSON(babelFiles[0]);
      _.extend(options, babelConfig);

      // Resolve default presets and plugins
      Object.assign(options, {
        presets: resolveDependencies('preset', options.presets),
        plugins: resolveDependencies('plugin', options.plugins),
      });
    } else {
      aden.log.info('No .babelrc in root, using default presets.');
      Object.assign(options, {
        presets: [
          require.resolve('babel-preset-es2015'),
        ],
      });
    }

    // Default overrides
    Object.assign(options, { 
      babelrc: false,
      highlightCode: true,
      forceEnv: aden.isDEV ? 'development' : 'production',
    });

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
