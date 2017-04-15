const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const hogan = require('hogan.js');

module.exports = (aden) => {
  aden.registerKey({
    name: 'hbs',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'hbsFile',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.hbs$/, ({ page, fileInfo }) => {
    if (fileInfo.name === page.hbs) {
      Object.assign(page, {
        hbsFile: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('setup:route', ({ page }) => {
    if (page.hbsFile) {
      const builtFilePath = path.resolve(
        page.resolved.dist,
        `${page.entryName}.html.hbs`
      );

      const wrapper = fs.readFileSync(builtFilePath, 'utf8');
      const wrapperTemplate = hogan.compile(wrapper);

      const hbsContent = fs.readFileSync(page.resolved.hbsFile, 'utf8');
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
            const liveContent = fs.readFileSync(page.resolved.hbsFile, 'utf8');
            const template = hogan.compile(liveContent);
            console.log(data);
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
        webpackEntry.push(page.resolved.hbsFile);
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
        include: [page.resolved.path],
        loader: 'mustache',
      });
    }
  });

  return {
    key: 'hbs',
    version: '0.1.0',
  };
};
