const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const hogan = require('hogan.js');

/**
 * layout
 * TODO: Register hooks for layout compilation, to hook in with hbs/md to compile templates
 */
module.exports = (aden) => {
  aden.registerKey('layout', {
    type: 'string',
    config: true,
    inherit: true,
    value: null,
  });

  aden.registerKey('getLayout', {
    type: 'function',
    inherit: true,
    value: null,
  });

  aden.registerKey('selectedLayout', {
    type: 'rpath',
    inherit: true,
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
  aden.registerFiles('layoutFiles', /^layout\..*?\.(html|hbs|handlebars|mustache|md|markdown)$/, {
    fn: ({ page, fileInfo }) => {
      Object.assign(page.key.layouts, {
        value: page.key.layouts.value.concat([{ fileInfo }]),
      });

      if (fileInfo.name.match(page.key.layout.value)) {
        Object.assign(page.key.selectedLayout, {
          value: fileInfo.rpath,
        });
        return;
      }
    },
    key: {
      build: true,
    },
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
