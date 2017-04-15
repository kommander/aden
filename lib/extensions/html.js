const fs = require('fs');
const _ = require('lodash');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

// TODO: integrate https://github.com/jantimon/html-webpack-plugin better/deeper with its addons

module.exports = (aden) => {
  aden.registerKey({
    name: 'html',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'htmlFile',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.html$/, ({ page, fileInfo }) => {
    aden.logger.debug('html file handler', { page: _.pick(page, [
      'name', 'route', 'html',
    ]), fileInfo });

    if (fileInfo.name === page.html) {
      Object.assign(page, {
        htmlFile: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('setup:route', ({ page }) => {
    if (page.htmlFile) {
      const builtFilePath = path.resolve(
        page.resolved.dist,
        `${page.entryName}.html`
      );

      aden.logger.debug('html setup walk', { page: _.pick(page, [
        'name', 'route', 'htmlFile', 'resolved',
      ]), builtFilePath });

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

  aden.hook('apply', ({ page, webpackConfig, webpackEntry }) => {
    if (page.htmlFile) {
      // && page.bundleTemplate === true) {
      if (aden.isDEV) {
        webpackEntry.push(page.resolved.htmlFile);
      }

      const chunks = [page.entryName];
      if (page.commons) {
        chunks.unshift('commons');
      }

      const htmlPlugin = new HtmlWebpackPlugin({
        template: page.resolved.htmlFile,
        filename: `../${page.entryName}.html`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name,
      });

      webpackConfig.plugins.push(htmlPlugin);

      webpackConfig.module.loaders.push({
        test: /\.html$/,
        include: [page.resolved.path],
        loader: 'html?attrs[]=img:src&attrs[]=link:href',
      });
    }
  });

  return {
    key: 'html',
    version: '0.1.0',
  };
};
