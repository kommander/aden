const fs = require('fs');
const hogan = require('hogan.js');

/**
 * layout
 * TODO: rename to wrapper
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
  aden.registerFiles('layoutFiles', /^layout\..*?\.(html|hbs|md)$/, {
    handler: ({ page, fileInfo }) => {
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
  });

  // Note the appropriate loaders have to be added by the attitude using the layout.
  aden.hook('html', ({ page, data }) => {
    if (page.key.getLayout.value) {
      Object.assign(data, {
        html: page.key.getLayout.value().render({ page, body: data.html }),
      });
    }
    // layout.default.html -> html loader -> dynamic_entry -> HTMLExposePlugin
    //  -> event hooks for attitude -> aden.hook('html') -> wrap(html) ->
  });

  aden.hook('load', ({ page }) => {
    if (page.key.selectedLayout.value) {
      Object.assign(page.key.getLayout, {
        value: getWrapper(page.key.selectedLayout.resolved),
      });
    }
  });
};
