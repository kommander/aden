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
      forceEnv: aden.isDEV ? 'development' : 'production',
    };

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
        presets: (options.presets || []).map((preset) => {
          try {
            return resolve.sync(`babel-preset-${preset}`, { basedir: aden.rootPath });
          } catch(ex) {
            aden.log.debug('Preset not found in app node_modules', ex);
          }

          try {
            return resolve.sync(`babel-preset-${preset}`, { 
              basedir: path.resolve(__dirname, '../'),
            });
          } catch(ex) {
            aden.log.debug('Preset not found in aden node_modules', ex);
          }

          return preset;
        }),
      });
    } else {
      aden.log.info('No .babelrc in root, using default presets.');
      Object.assign(options, {
        presets: [
          require.resolve('babel-preset-es2015'),
        ],
      });
    }

    Object.assign(options, { babelrc: false });

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
