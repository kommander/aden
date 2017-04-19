const fs = require('fs');
const marked = require('marked');

/**
 * hbs
 * Gathers
 */
module.exports = (aden) => {
  // TODO: use short keys for ext config { md: { entry: 'index', markedOptions, ... }}
  aden.registerKey('md', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  aden.registerKey('mdIndex', {
    type: 'rpath',
  });

  aden.registerKey('marked', {
    type: 'config',
    value: {},
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFiles('mdFiles', /\.md$/, {
    fn: ({ page, fileInfo }) => {
      if (fileInfo.name === page.key.md.value) {
        Object.assign(page.key.mdIndex, {
          value: fileInfo.rpath,
        });
        return;
      }
    },
  });

  aden.hook('setup:route', ({ page }) => {
    if (page.key.mdIndex.value) {
      const content = fs.readFileSync(page.key.mdIndex.resolved, 'utf8');
      const cached = marked(content);

      if (!aden.isDEV) {
        Object.assign(page, {
          get: (req, res) => {
            // todo: make sure to send correct headers
            res.send(cached);
          },
        });
      } else {
        Object.assign(page, {
          get: (req, res) => {
            const liveContent = fs.readFileSync(page.key.mdIndex.resolved, 'utf8');
            res.send(marked(liveContent));
          },
        });
      }
    }
  });

  return {
    key: 'md',
    version: '0.1.0',
  };
};
