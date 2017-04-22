const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const hogan = require('hogan.js');
const cannot = require('cannot');

/**
 * hbs
 * Gathers
 */
module.exports = (aden) => {
  aden.registerKey('hbs', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  aden.registerKey('hbsIndex', {
    type: 'rpath',
  });

  aden.registerKey('templates', {
    type: 'custom',
    value: {},
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFiles('hbsFiles', /\.hbs$/, {
    fn: ({ page, fileInfo }) => {
      if (fileInfo.name === page.key.hbs.value) {
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
      const builtFilePath = path.resolve(
        aden.rootConfig.dist,
        `${page.entryName}.html.hbs`
      );

      const wrapper = fs.readFileSync(builtFilePath, 'utf8');
      const wrapperTemplate = hogan.compile(wrapper);

      const hbsContent = fs.readFileSync(page.key.hbsIndex.resolved, 'utf8');
      const cachedTemplate = hogan.compile(hbsContent);

      if (!aden.isDEV) {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            // todo: make sure to send correct headers
            const body = cachedTemplate.render({ page: thepage, data });
            const html = wrapperTemplate.render({
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
            const liveContent = fs.readFileSync(page.key.hbsIndex.resolved, 'utf8');
            const template = hogan.compile(liveContent);
            const body = template.render({ page: thepage, data });
            const html = wrapperTemplate.render({
              body,
              page: thepage,
              data,
            });

            res.send(html);
          },
        });
      }
    }
  });

  aden.hook('apply', ({ page, webpackConfigs, webpackEntry }) => {
    if (page.key.hbsIndex.value) {
      // && page.bundleTemplate === true) {
      if (aden.isDEV) {
        webpackEntry.push(page.key.hbsIndex.resolved);
      }


      const chunks = [page.entryName, 'global'];
      if (page.commons) {
        chunks.unshift('commons');
      }

      const hbsPlugin = new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'empty.html'),
        filename: `../${page.entryName}.html.hbs`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name || 'No Title',
      });

      webpackConfigs[0].plugins.push(hbsPlugin);

      webpackConfigs[0].module.loaders.push({
        test: /\.(mustache|hbs|handlebars)$/,
        include: [
          page.key.path.resolved,
          path.resolve(page.key.path.resolved, 'node_modules'),
          path.resolve(page.key.path.resolved, '../node_modules'),
          path.resolve(page.key.path.resolved, '../../node_modules'),
          path.resolve(page.rootPath, 'node_modules'),
        ],
        loader: 'mustache',
      });
    }
  });

  return {
    key: 'hbs',
    version: '0.2.0',
  };
};
