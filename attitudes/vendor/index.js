const webpack = require('webpack');
const { DllPlugin, DllReferencePlugin } = webpack;
const _ = require('lodash');
const path = require('path');

/**
 * layout
 */
module.exports = (aden) => {
  const {
    KEY_STRING_ARRAY,
  } = aden.constants;

  aden.registerKey('vendor', {
    type: KEY_STRING_ARRAY,
    config: true,
    value: null,
  });

  aden.hook('pre:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    const pagesWithVendorConfig = aden.flattenPages(pages)
      .filter((page) => (page.vendor.value.length > 0));

    const entry = pagesWithVendorConfig
      .map((page) => {
        if (!page.assets.value.includes('v-vendor.js')) {
          page.assets.value.push('v-vendor.js');
        }
        return page.vendor.value;
      })
      .reduce((prev, arr) => prev.concat(arr), []);

    const uniq = _.uniq(entry);
    if (uniq.length > 0) {
      const manifestPath = path.join(aden.settings.dist, 'vendor-manifest.json');
      const dllPlugin = new DllPlugin({
        context: frontendConfig.context,
        name: '[name]_lib',
        path: manifestPath,
      });

      const config = {
        entry: { vendor: uniq },
        name: 'vendor',
        target: 'web',
        output: {
          filename: 'v-[name].js',
          path: frontendConfig.output.path,
          publicPath: frontendConfig.output.publicPath,
          library: '[name]_lib',
        },
        context: frontendConfig.context,
        resolve: {
          modules: frontendConfig.resolve.modules,
        },
        module: frontendConfig.module,
        plugins: [dllPlugin],
      };

      pagesWithVendorConfig.forEach((page) => aden.applyPagePathsToConfig(config, page));

      // webpackConfigs.unshift(config);
      return Promise.resolve()
        .then(() => new Promise((resolve, reject) => {
          const compiler = webpack(config);
          compiler.run((err, stats) => {
            if (err) {
              aden.log.error('Vendor compilation', err);
              reject(err);
              return;
            }

            const dllReferencePlugin = new DllReferencePlugin({
              context: frontendConfig.context,
              manifest: manifestPath,
              // sourceType: 'commonjs',
            });
            frontendConfig.plugins.push(dllReferencePlugin);

            resolve();
          });
        }));
    }
  });
};
