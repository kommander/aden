const HtmlWebpackPlugin = require('html-webpack-plugin');
const _ = require('lodash');

/**
 * layout
 */
module.exports = (aden) => {
  aden.registerKey('layout', {
    type: 'string',
    config: true,
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

  aden.registerFiles('layoutFiles', /^layout\..*?\.(html|hbs|md)$/, {
    handler: ({ page, fileInfo }) => {
      page.set('layouts', page.layouts.value.concat([{ fileInfo }]));
    },
  });

  aden.hook('pre:load', ({ page }) => {
    const pageLayout = page.layouts.value
      .find((layout) =>
        layout.fileInfo.name.match(page.layout.value)
    );

    if (pageLayout) {
      page.set('selectedLayout', pageLayout.fileInfo.rpath);
      return;
    }
  });

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));
    const layoutPages = pages
      .filter((page) => (page.selectedLayout.value));
    const entry = layoutPages
      .map((page) => page.selectedLayout.resolved);

    // TODO: Let aden apply paths and context
    // Use something like aden.registerWebpack('layout', { config }, { before: 'frontend', invalidates: true })
    const uniq = _.uniq(entry);
    if (uniq.length > 0) {
      const config = {
        entry: uniq,
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
          .filter((page) => (page.selectedLayout.value))
          .map((page) => new HtmlWebpackPlugin({
            template: page.selectedLayout.resolved,
            filename: page.selectedLayout.dist,
            inject: false,
            cache: aden.isDEV,
          })),
      };
      aden.invalidate('layout', 'frontend');
      webpackConfigs.unshift(config);
    }
  });

  aden.hook('html', ({ page, data }) => {
    if (page.selectedLayout.value) {
      return page.selectedLayout
        .load()
        .then((buffer) => buffer.toString('utf8'))
        .then((wrapper) => Object.assign(data, {
          html: wrapper.replace(/[\{]{1,3}\w?body\w?[\}]{1,3}/ig, data.html),
        }));
    }
    return null;
  });
};
