const VendorPlugin = require('./plugin');

module.exports = (aden) => {
  aden.hook('post:apply', ({ pages, webpackConfigs, paths }) => {
    const vendorPlugin = new VendorPlugin({
      dist: aden.rootConfig.dist,
    });
    webpackConfigs[0].plugins.push(vendorPlugin);
  });
};
