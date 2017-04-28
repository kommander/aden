const fs = require('fs');
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
    build: true,
  });

  aden.registerKey('mdLayout', {
    type: 'rpath',
    inherit: true,
    value: path.resolve(__dirname, 'empty.html'),
    build: true,
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
    key: {
      build: true,
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
    key: {
      build: true,
    },
  });

  const getWrapper = (page) => {
    const wrapper = fs.readFileSync(page.key.mdLayout.dist, 'utf8');
    const wrapperTemplate = hogan.compile(wrapper);

    return wrapperTemplate;
  };

  aden.hook('setup:route', ({ page }) => {
    if (page.key.mdIndex.value) {
      const cachedWrapperTemplate = getWrapper(page);

      const cached = fs.readFileSync(page.key.mdIndex.dist, 'utf8');

      if (aden.isPROD) {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            // todo: make sure to send correct headers
            const html = cachedWrapperTemplate.render({
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
            const liveContent = fs.readFileSync(page.key.mdIndex.dist, 'utf8');
            const html = getWrapper(page).render({
              body: liveContent,
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
      const cachedWrapperTemplate = getWrapper(page);

      page.key.mdFiles.value
        .filter((file) => file.name !== page.key.md.value) // not index file
        .forEach((fileInfo) => {
          let controller;

          if (aden.isPROD) {
            const cached = fs.readFileSync(fileInfo.dist, 'utf8');

            controller = (req, res) => {
              const html = cachedWrapperTemplate.render({
                body: cached,
                page,
              });

              res.send(html);
            };
          } else {
            controller = (req, res) => {
              const liveContent = fs.readFileSync(fileInfo.dist, 'utf8');
              const html = getWrapper(page).render({
                body: liveContent,
                page,
              });

              res.send(html);
            };
          }

          page.router.get(`/${fileInfo.file}`, controller);
        });
    }
  });

  aden.hook('post:apply', ({ webpackConfigs }) => {
    webpackConfigs[0].module.rules.push({
      test: /\.md$/,
      use: [
        {
          loader: require.resolve('html-loader'),
          // options: {},
        },
        {
          loader: require.resolve('markdown-loader'),
          // TODO: take marked options from .server config md key
          // options: {},
        },
      ],
    });
  });

  aden.hook('apply', ({ page, webpackConfigs }) => {
    if (page.key.mdIndex.value || page.key.mdFiles.value.length > 0) {
      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      if (page.key.mdIndex.value) {
        const mdIndexPlugin = new HtmlWebpackPlugin({
          template: page.key.mdIndex.resolved,
          filename: page.key.mdIndex.dist,
          inject: false,
          cache: false,
        });
        webpackConfigs[0].plugins.push(mdIndexPlugin);
      }

      page.key.mdFiles.value.forEach((mdFile) => {
        const mdPlugin = new HtmlWebpackPlugin({
          template: mdFile.resolved,
          filename: mdFile.dist,
          inject: false,
          cache: false,
        });

        webpackConfigs[0].plugins.push(mdPlugin);
      });

      const mdLayoutPlugin = new HtmlWebpackPlugin({
        template: page.key.mdLayout.resolved,
        filename: page.key.mdLayout.dist,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name || 'No Title',
      });

      webpackConfigs[0].plugins.push(mdLayoutPlugin);
    }
  });

  return {
    key: 'md',
    version: '0.1.0',
  };
};
