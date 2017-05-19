const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const hogan = require('hogan.js');

/**
 * layout
 * TODO: Expose render hooks to influence the response of other attitudes,
 *       so they don't have to be aware of the layout attitude.
 * TODO: Register hooks for layout compilation, to hook in with hbs/md to compile templates
 */
module.exports = (aden) => {
  aden.registerKey('layout', {
    type: 'string',
    config: true,
    value: null,
  });

  aden.registerKey('getLayout', {
    type: 'function',
    value: null,
  });

  aden.registerKey('selectedLayout', {
    type: 'rpath',
    // default: path.resolve(__dirname, 'empty.html'),
    build: true,
  });

  aden.registerKey('layouts', {
    type: 'stringarray',
    inherit: true,
    value: [],
  });

  const getWrapper = (layoutPath) => () => {
    const wrapper = fs.readFileSync(layoutPath, 'utf8');
    const wrapperTemplate = hogan.compile(wrapper);
    return wrapperTemplate;
  };

  // TODO: make extensions setable via page.key and let other extensions add to them
  //       when they add a loader and layout is available.
  aden.registerFiles('layoutFiles', /^layout\..*?\.(html|hbs|md)$/, {
    fn: ({ page, fileInfo }) => {
      Object.assign(page.key.layouts, {
        value: page.key.layouts.value.concat([{ fileInfo }]),
      });
    },
    key: {
      build: true,
    },
  });

  aden.hook('pre:load', ({ page }) => {
    const layout = page.keys.find((key) => (key.name === 'layout')).value;
    const selectedLayout = (page.keys
      .find((key) => (key.name === 'layouts'))
      .value || [])
      .find((availableLayout) =>
        availableLayout.fileInfo.name.match(layout)
      );
    if (selectedLayout) {
      Object.assign(page.keys.find((key) => (key.name === 'selectedLayout')), {
        value: selectedLayout.fileInfo.rpath,
      });
    }
  });

  // Note the appropriate loaders have to be added by the attitude using the layout.
  aden.hook('apply', ({ page, webpackConfigs }) => {
    if (page.key.selectedLayout.value) {
      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      const layoutPlugin = new HtmlWebpackPlugin({
        template: page.key.selectedLayout.resolved,
        filename: page.key.selectedLayout.dist,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name || 'No Title',
      });

      webpackConfigs[0].plugins.push(layoutPlugin);
    }
  });

  aden.hook('load', ({ page }) => {
    if (page.key.selectedLayout.value) {
      Object.assign(page.key.getLayout, {
        value: getWrapper(page.key.selectedLayout.dist),
      });
    }
  });
};
