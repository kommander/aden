const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const hogan = require('hogan.js');
const cannot = require('brokens');

/**
 * hbs
 * Gathers
 */
module.exports = (aden) => {
  aden.registerKey('hbs', {
    type: 'object',
    config: true,
    value: {
      entry: 'index',
      layout: true,
    },
    inherit: true,
  });

  aden.registerKey('hbsIndex', {
    type: 'rpath',
    build: true,
  });

  aden.registerKey('templates', {
    type: 'custom',
    value: {},
  });

  aden.registerFiles('hbsFiles', /\.(hbs|hdbs)$/, {
    fn: ({ page, fileInfo }) => {
      if (fileInfo.name === page.key.hbs.value.entry) {
        Object.assign(page.key.hbsIndex, {
          value: fileInfo.rpath,
        });
        return;
      }
    },
  });

  aden.hook('load', ({ page }) =>
    Promise.resolve().then(() => {
      page.key.hbsFiles.value.forEach((file) => {
        try {
          const content = fs.readFileSync(file.resolved, 'utf8');
          const template = hogan.compile(content);
          Object.assign(page.key.templates.value, {
            [file.name]: {
              content,
              render: (data, partials) => template.render(data, partials),
            },
          });
        } catch (ex) {
          throw cannot('compile', 'hbs template')
            .because(ex)
            .addInfo(file.resolved);
        }
      });
    })
  );

  aden.hook('setup:route', ({ page }) => {
    if (page.key.hbsIndex.value) {
      if (aden.isPROD) {
        const wrapperTemplate = page.key.hbs.value.layout
          && page.key.getLayout && page.key.getLayout.value
          ? page.key.getLayout.value()
          : { render: ({ body }) => body };

        const hbsContent = fs.readFileSync(page.key.hbsIndex.dist, 'utf8');
        const cachedTemplate = hogan.compile(hbsContent);

        Object.assign(page, {
          get: (req, res, thepage, data) => {
            // todo: make sure to send correct headers
            const body = cachedTemplate.render({ req, res, page: thepage, data });
            const html = wrapperTemplate.render({
              req,
              res,
              body,
              page: thepage,
              data,
            });

            res.send(html);
          },
        });
      } else {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            const liveContent = fs.readFileSync(page.key.hbsIndex.dist, 'utf8');
            const template = hogan.compile(liveContent);
            const live = template.render({ req, res, page: thepage, data });
            const html = (page.key.hbs.value.layout
              && page.key.getLayout && page.key.getLayout.value
              ? page.key.getLayout.value()
              : { render: ({ body }) => body })
              .render({
                req,
                res,
                body: live,
                page: thepage,
                data,
              });

            res.send(html);
          },
        });
      }
    }
  });

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    webpackConfigs[0].resolve.extensions.push(
      '.hbs', '.hdbs', '.handlebars'
    );

    webpackConfigs[0].module.rules.push({
      test: /\.(hbs|hdbs|handlebars)$/,
      include: [
        path.resolve(pages[0].rootPath, '../node_modules'),
        path.resolve(pages[0].rootPath, '../../node_modules'),
      ].concat(aden.flattenPages(pages).map((page) => page.key.path.resolved)),
      use: [
        {
          loader: require.resolve('html-loader'),
          // options: {
          //   minimize: aden.isPROD,
          // },
        },
      ],
    });
  });

  aden.hook('apply', ({ page, webpackConfigs, webpackEntry }) => {
    if (page.key.hbsIndex.value) {
      if (aden.isDEV) {
        webpackEntry.push(page.key.hbsIndex.resolved);
      }

      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      const hbsPlugin = new HtmlWebpackPlugin({
        template: page.key.hbsIndex.resolved,
        filename: page.key.hbsIndex.dist,
        inject: !page.key.hbs.value.layout
          || !page.key.selectedLayout || !page.key.selectedLayout.value,
        cache: false,
        chunks,
        showErrors: aden.isDEV,
      });

      webpackConfigs[0].plugins.push(hbsPlugin);
    }
  });
};
