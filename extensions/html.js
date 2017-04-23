const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

// TODO: type 'config' for keys that can be derived from .server
module.exports = (aden) => {
  aden.registerKey('html', {
    type: 'string',
    value: 'index',
    inherit: true,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile('htmlFile', ({ page, fileInfo }) =>
    fileInfo.file.match(/\.html$/) && fileInfo.name === page.key.html.value
  );

  aden.hook('setup:route', ({ page }) => {
    if (page.key.htmlFile.value) {
      const builtFilePath = path.resolve(
        aden.rootConfig.dist,
        `${page.entryName}.html`
      );

      const htmlContent = fs.readFileSync(builtFilePath, 'utf8');

      if (!aden.isDEV) {
        Object.assign(page, {
          get: (req, res) => {
            // todo: make sure to send correct headers
            res.send(htmlContent);
          },
        });
      } else {
        Object.assign(page, {
          get: (req, res) => {
            const liveContent = fs.readFileSync(builtFilePath, 'utf8');
            res.send(liveContent);
          },
        });
      }
    }
  });

  aden.hook('post:apply', ({ pages, webpackConfigs }) => {
    webpackConfigs[0].module.rules.push({
      test: /\.html$/,
      include: [
        path.resolve(pages[0].rootPath, '../'),
      ].concat(aden.flattenPages(pages).map((page) => page.key.path.resolved)),
      loader: 'html-loader?attrs[]=img:src&attrs[]=link:href',
    });
  });

  aden.hook('apply', ({ page, webpackConfigs, webpackEntry }) => {
    if (page.key.htmlFile.value) {
      // && page.bundleTemplate === true) {
      if (aden.isDEV) {
        webpackEntry.push(page.key.htmlFile.resolved);
      }

      const chunks = ['global', page.entryName];

      if (page.commons) {
        chunks.unshift('commons');
      }

      const htmlPlugin = new HtmlWebpackPlugin({
        template: page.key.htmlFile.resolved, // `!!ejs!${page.key.htmlFile.resolved}`,
        filename: `../${page.entryName}.html`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name,
        showErrors: aden.isDEV,
      });

      webpackConfigs[0].plugins.push(htmlPlugin);
    }
  });

  return {
    key: 'html',
    version: '0.2.0',
  };
};
