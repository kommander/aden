const HtmlWebpackPlugin = require('html-webpack-plugin');
const _ = require('lodash');

/**
 * layout
 */
module.exports = (aden) => {
  aden.registerKey('layout', {
    type: 'string',
    config: true,
    // inherit: true,
    value: null,
  });

  aden.registerKey('selectedLayout', {
    type: 'rpath',
    distExt: '.html',
    // default: path.resolve(__dirname, 'empty.html'),
  });

  aden.registerKey('layouts', {
    type: 'stringarray',
    inherit: true,
    value: [],
  });

  // TODO: make extensions setable via page.key and let other extensions add to them
  //       when they add a loader and layout is available.
  aden.registerFiles('layoutFiles', /^layout\..*?\.(html|hbs|md)$/, {
    handler: ({ page, fileInfo }) => {
      Object.assign(page.key.layouts, {
        value: page.key.layouts.value.concat([{ fileInfo }]),
      });
    },
  });

  aden.hook('pre:load', ({ page }) => {
    const pageLayout = page.keys
      .find((k) => (k.name === 'layouts')).value
      .find((layout) =>
        layout.fileInfo.name.match(page.keys
          .find((k) => (k.name === 'layout')).value)
    );

    if (pageLayout) {
      Object.assign(page.keys.find((k) =>
        (k.name === 'selectedLayout')),
        {
          value: pageLayout.fileInfo.rpath,
        });
      return;
    }
  });

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    const entry = aden.flattenPages(pages)
      .filter((page) => (page.key.selectedLayout.value))
      .map((page) => page.key.selectedLayout.resolved);

    // TODO: Let aden apply paths and context
    // Use something like aden.registerWebpack('layout', { config }, { before: 'frontend'})
    if (entry.length > 0) {
      const config = {
        entry: _.uniq(entry),
        name: 'layout',
        target: 'web',
        output: {
          filename: '../layout.bundle.js',
          path: frontendConfig.output.path,
          publicPath: frontendConfig.output.publicPath,
        },
        context: frontendConfig.context,
        resolve: {
          modules: frontendConfig.resolve.modules,
        },
        module: frontendConfig.module,
        plugins: aden.flattenPages(pages)
          .filter((page) => (page.key.selectedLayout.value))
          .map((page) => new HtmlWebpackPlugin({
            template: page.key.selectedLayout.resolved,
            filename: page.key.selectedLayout.dist,
            inject: false,
            cache: aden.isDEV,
          })
        ),
      };
      webpackConfigs.unshift(config);
    }
  });

  aden.hook('html', ({ page, data }) => {
    if (page.key.selectedLayout.value) {
      return page.key.selectedLayout
        .load()
        .then((buffer) => buffer.toString('utf8'))
        .then((wrapper) => Object.assign(data, {
          html: wrapper.replace(/[\{]{1,3}\w?body[\}]{1,3}/, data.html),
        }));
    }
    return null;
  });
};
