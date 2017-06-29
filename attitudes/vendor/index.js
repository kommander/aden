const webpack = require('webpack');
const { DllPlugin, DllReferencePlugin } = webpack;
const _ = require('lodash');
const path = require('path');

/**
 * Vendor
 * Allows to mark modules/paths as vendor assets and pre-compiles them
 * into a vendor bundle, which is injected into entry points.
 */
module.exports = (aden) => {
  const {
    KEY_STRING_ARRAY,
    KEY_OBJECT,
  } = aden.constants;

  aden.registerKey('vendor', {
    type: KEY_STRING_ARRAY,
    config: true,
    value: null,
  });

  aden.registerKey('vendors', {
    type: KEY_OBJECT,
    config: true,
    value: null,
  });

  aden.hook('pre:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    const pagesWithVendorConfig = aden.flattenPages(pages)
      .filter((page) => (page.vendor.value.length > 0));

    const entry = {};

    const entries = pagesWithVendorConfig
      .map((page) => {
        if (!page.assets.value.includes('v_vendor.js')) {
          page.assets.value.push('v_vendor.js');
        }
        return page.vendor.value;
      })
      .reduce((prev, arr) => prev.concat(arr), []);
    const uniq = _.uniq(entries);

    if (uniq.length > 0) {
      Object.assign(entry, {
        'v_vendor': uniq,
      });
    }

    const pagesWithVendorsConfig = aden.flattenPages(pages)
      .filter((page) => (page.vendors.value && Object.keys(page.vendors.value).length > 0));

    _.merge.apply(null, [entry].concat(pagesWithVendorsConfig
      .map((page) => page.vendors.value))
    );

    pagesWithVendorsConfig.forEach((page) => {
      const vendorNames = Object.keys(page.vendors.value);
      vendorNames.forEach((vendorName) => {
        if (!page.assets.value.includes(`${vendorName}.js`)) {
          page.assets.value.push(`${vendorName}.js`);
        }
      });
    });

    if (Object.keys(entry).length) {
      const manifestPath = path.join(aden.settings.dist, 'vendor-manifest.json');
      const dllPlugin = new DllPlugin({
        context: frontendConfig.context,
        name: '[name]_lib',
        path: manifestPath,
      });

      const config = {
        entry,
        name: 'vendor',
        target: 'web',
        output: {
          filename: '[name].js',
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

      pagesWithVendorConfig
        .concat(pagesWithVendorsConfig)
        .forEach((page) => aden.applyPagePathsToConfig(config, page));

      return Promise.resolve()
        .then(() => new Promise((resolve, reject) => {
          const compiler = webpack(config);
          compiler.run((err, stats) => {
            const error = err || stats.compilation.errors[0];
            if (error) {
              aden.log.error('Vendor compilation', error);
              reject(error);
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
