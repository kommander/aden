const VendorPlugin = require('./plugin');
const path = require('path');

module.exports = (aden) => {
  aden.hook('post:apply', ({ pages, webpackConfigs, paths }) => {
    const vendorPlugin = new VendorPlugin({
      dist: aden.rootConfig.dist,
      context: aden.rootPath,
      publicPath: aden.rootConfig.publicPath,
      resolvePaths: [
        paths.aden_node_modules,
        path.resolve(paths.aden_node_modules, '../../../node_modules'),
      ],
    });
    webpackConfigs[0].plugins.push(vendorPlugin);
  });
};
