const fs = require('fs');
const marked = require('marked');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const hogan = require('hogan.js');

/**
 * md
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
      const builtFilePath = path.resolve(
        aden.rootConfig.dist,
        `${page.entryName}.html.md`
      );

      const wrapper = fs.readFileSync(builtFilePath, 'utf8');
      const wrapperTemplate = hogan.compile(wrapper);

      const content = fs.readFileSync(page.key.mdIndex.resolved, 'utf8');
      const cached = marked(content);

      if (!aden.isDEV) {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            // todo: make sure to send correct headers
            const html = wrapperTemplate.render({
              body: cached,
              page: thepage,
              data,
            });

            res.send(html);
          },
        });
      } else {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            const liveContent = fs.readFileSync(page.key.mdIndex.resolved, 'utf8');
            const html = wrapperTemplate.render({
              body: marked(liveContent),
              page: thepage,
              data,
            });

            res.send(html);
          },
        });
      }
    }
  });

  aden.hook('apply', ({ page, webpackConfigs /* , webpackEntry */ }) => {
    if (page.key.mdIndex.value) {
      // if (page.key.mdIndex.value) {
      //   webpackEntry.push(page.key.mdIndex.resolved);
      // }

      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      const mdPlugin = new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'empty.html'),
        filename: `../${page.entryName}.html.md`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name || 'No Title',
      });

      webpackConfigs[0].plugins.push(mdPlugin);
    }
  });

  return {
    key: 'md',
    version: '0.1.0',
  };
};
