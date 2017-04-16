const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const hogan = require('hogan.js');

module.exports = (aden) => {
  aden.registerKey('hbs', {
    type: 'string',
    value: 'index',
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile('hbsFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.hbs$/) && fileInfo.name === page.hbs
  );

  aden.hook('setup:route', ({ page }) => {
    if (page.hbsFile) {
      const builtFilePath = path.resolve(
        aden.rootConfig.dist,
        `${page.entryName}.html.hbs`
      );

      const wrapper = fs.readFileSync(builtFilePath, 'utf8');
      const wrapperTemplate = hogan.compile(wrapper);

      const hbsContent = fs.readFileSync(page.key.hbsFile.resolved, 'utf8');
      const cachedTemplate = hogan.compile(hbsContent);

      if (!aden.isDEV) {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            // todo: make sure to send correct headers
            const body = cachedTemplate.render({ page: thepage, data });
            const html = wrapperTemplate.render({
              body,
            });

            res.send(html);
          },
        });
      } else {
        Object.assign(page, {
          get: (req, res, thepage, data) => {
            const liveContent = fs.readFileSync(page.key.hbsFile.resolved, 'utf8');
            const template = hogan.compile(liveContent);
            const body = template.render({ page: thepage, data });
            const html = wrapperTemplate.render({
              body,
            });

            res.send(html);
          },
        });
      }
    }
  });

  aden.hook('apply', ({ page, webpackConfig, webpackEntry }) => {
    if (page.hbsFile) {
      // && page.bundleTemplate === true) {
      if (aden.isDEV) {
        webpackEntry.push(page.key.hbsFile.resolved);
      }


      const chunks = [page.entryName];
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

      webpackConfig.plugins.push(hbsPlugin);

      webpackConfig.module.loaders.push({
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
    version: '0.1.0',
  };
};
