const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * md
 */
module.exports = (aden) => {
  aden.registerKey('md', {
    type: 'object',
    config: true,
    value: {
      entry: 'index',
      marked: null,
      layout: true,
    },
    inherit: true,
  });

  aden.registerKey('mdIndex', {
    type: 'rpath',
    build: true,
  });

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
        const cachedWrapperTemplate = page.key.md.value.layout
          && page.key.getLayout && page.key.getLayout.value
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
            const html = (page.key.md.value.layout
              && page.key.getLayout && page.key.getLayout.value
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
            const cachedWrapperTemplate = page.key.md.value.layout
              && page.key.getLayout && page.key.getLayout.value
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
              const html = (page.key.md.value.layout
                && page.key.getLayout && page.key.getLayout.value
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

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    webpackConfigs[0].resolve.extensions.push('.md', '.markdown');
    const markdownLoader = {
      loader: require.resolve('markdown-loader'),
    };

    // The loader treats an empty object as options with parseQuery(),
    // which is deprecated. Might show different behaviour with md-loader versions > 2.0.0
    const markedOpts = pages[0].key.md.value.marked;
    if (markedOpts && Object.keys(markedOpts).length > 0) {
      Object.assign(markdownLoader, {
        options: markedOpts,
      });
    }

    webpackConfigs[0].module.rules.push({
      test: /\.(md|markdown)$/,
      use: [
        {
          loader: require.resolve('html-loader'),
          // options: {
          //   minimize: aden.isPROD,
          // },
        },
        markdownLoader,
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
          inject: !page.key.selectedLayout || !page.key.selectedLayout.value,
          cache: false,
          chunks,
          showErrors: aden.isDEV,
        });
        webpackConfigs[0].plugins.push(mdIndexPlugin);
      }

      page.key.mdFiles.value.forEach((mdFile) => {
        const mdPlugin = new HtmlWebpackPlugin({
          template: mdFile.resolved,
          filename: mdFile.dist,
          inject: !page.key.getLayout || !page.key.selectedLayout.value,
          cache: false,
          chunks,
          showErrors: aden.isDEV,
        });

        webpackConfigs[0].plugins.push(mdPlugin);
      });
    }
  });
};
