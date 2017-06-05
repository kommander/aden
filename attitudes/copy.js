const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (attitude) => {
  const {
    KEY_ARRAY,
    KEY_OBJECT,
  } = attitude.constants;

  // Allows .server { copy: [{ from: ..., to: ... }] },
  // -> https://github.com/kevlened/copy-webpack-plugin
  attitude.registerKey('copy', {
    type: KEY_ARRAY,
    value: [],
    config: true,
  });

  attitude.registerKey('copyOptions', {
    type: KEY_OBJECT,
    value: {},
    config: true,
  });

  attitude.hook('apply', ({ page, webpackConfigs }) => {
    if (page.copy.value && page.copy.value.length > 0) {
      const frontendConfig = webpackConfigs
        .find((conf) => (conf.name === 'frontend'));

      frontendConfig.plugins.push(new CopyWebpackPlugin(
        page.copy.value,
        page.copyOptions.value
      ));
    }
  });
};
