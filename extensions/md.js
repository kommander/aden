const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
    },
    inherit: true,
  });

  aden.registerKey('mdIndex', {
    type: 'rpath',
    build: true,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFiles('mdFiles', /\.(md|markdown)$/, {
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

  aden.hook('setup:route', ({ page }) => {
    if (page.key.mdIndex.value) {
      if (aden.isPROD) {
        const cachedWrapperTemplate = page.key.getLayout.value
          ? page.key.getLayout.value()
          : { render: ({ body }) => body };
        const cached = fs.readFileSync(page.key.mdIndex.dist, 'utf8');

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
            const html = (page.key.getLayout.value
              ? page.key.getLayout.value()
              : { render: ({ body }) => body })
              .render({
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
      page.key.mdFiles.value
        .filter((file) => file.name !== page.key.md.value) // not index file
        .forEach((fileInfo) => {
          let controller;

          if (aden.isPROD) {
            const cached = fs.readFileSync(fileInfo.dist, 'utf8');
            const cachedWrapperTemplate = page.key.getLayout.value
              ? page.key.getLayout.value()
              : { render: ({ body }) => body };

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
              const html = (page.key.getLayout.value
                ? page.key.getLayout.value()
                : { render: ({ body }) => body })
                .render({
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
    webpackConfigs[0].resolve.extensions.push('.md', '.markdown');

    webpackConfigs[0].module.rules.push({
      test: /\.(md|markdown)$/,
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
    }
  });
};
