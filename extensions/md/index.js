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
    type: 'config',
    value: {
      entry: 'index',
      marked: {},
      layout: 'default',
    },
    inherit: true,
  });

  aden.registerKey('mdIndex', {
    type: 'rpath',
  });

  aden.registerKey('mdLayout', {
    type: 'rpath',
    inherit: true,
  });

  aden.registerKey('mdLayouts', {
    type: 'stringarray',
    inherit: true,
    value: [],
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFiles('mdFiles', /\.md$/, {
    fn: ({ page, fileInfo }) => {
      if (fileInfo.name === page.key.md.value.entry) {
        Object.assign(page.key.mdIndex, {
          value: fileInfo.rpath,
        });
        return;
      }
    },
  });

  aden.registerFiles('mdLayoutFiles', /^layout\..*?\.(html|hbs|md)$/, {
    fn: ({ page, fileInfo }) => {
      Object.assign(page.key.mdLayouts, {
        value: page.key.mdLayouts.value.concat([{ fileInfo }]),
      });

      if (fileInfo.name.match(page.key.md.value.layout)) {
        Object.assign(page.key.mdLayout, {
          value: fileInfo.rpath,
        });
        return;
      }
    },
  });

  const getWrapper = (page) => {
    const builtFilePath = path.resolve(
      aden.rootConfig.dist,
      `${page.entryName}.html.md`
    );

    const wrapper = fs.readFileSync(builtFilePath, 'utf8');
    const wrapperTemplate = hogan.compile(wrapper);

    return wrapperTemplate;
  };

  aden.hook('setup:route', ({ page }) => {
    if (page.key.mdIndex.value) {
      const wrapperTemplate = getWrapper(page);

      const content = fs.readFileSync(page.key.mdIndex.resolved, 'utf8');
      const cached = marked(content, page.key.md.value.marked);

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
              body: marked(liveContent, page.key.md.value.marked),
              page: thepage,
              data,
            });

            res.send(html);
          },
        });
      }
    }

    // Are there more md files than an index? Set them up.
    if (page.key.mdFiles.value.length > 0) {
      const wrapperTemplate = getWrapper(page);

      page.key.mdFiles.value
        .filter((file) => file.name !== page.key.md.value) // not index file
        .forEach((fileInfo) => {
          let controller;

          if (!aden.isDEV) {
            const content = fs.readFileSync(fileInfo.resolved, 'utf8');
            const cached = marked(content, page.key.md.value.marked);

            controller = (req, res) => {
              const html = wrapperTemplate.render({
                body: cached,
                page,
              });

              res.send(html);
            };
          } else {
            controller = (req, res) => {
              const liveContent = fs.readFileSync(fileInfo.resolved, 'utf8');
              const html = wrapperTemplate.render({
                body: marked(liveContent, page.key.md.value.marked),
                page,
              });

              res.send(html);
            };
          }

          page.router.get(`/${fileInfo.file}`, controller);
        });
    }
  });

  aden.hook('apply', ({ page, webpackConfigs, webpackEntry }) => {
    if (page.key.mdIndex.value || page.key.mdFiles.value.length > 0) {
      if (page.key.mdIndex.value) {
        webpackEntry.push(page.key.mdIndex.resolved);
      }

      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      const mdPlugin = new HtmlWebpackPlugin({
        template: page.key.mdLayout.resolved || path.resolve(__dirname, 'empty.html'),
        filename: `../${page.entryName}.html.md`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name || 'No Title',
      });

      webpackConfigs[0].plugins.push(mdPlugin);

      webpackConfigs[0].module.rules.push({
        test: /\.md$/,
        use: [
          {
            loader: require.resolve('html-loader'),
          },
          {
            loader: require.resolve('markdown-loader'),
            // options: {},
          },
        ],
      });
    }
  });

  return {
    key: 'md',
    version: '0.1.0',
  };
};
