const fs = require('fs');
const _ = require('lodash');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = (aden) => {
  aden.registerKey({
    name: 'html',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'htmlFile',
    type: 'rpath',
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

      Object.assign(page, {
        get: (req, res) => {
          // todo: make sure to send correct headers
          res.send(htmlContent);
        },
      });
    }
  });

  aden.hook('apply', ({ page, webpackConfig }) => {
    if (page.htmlFile) {
      const chunks = [page.entryName];
      if (page.commons) {
        chunks.unshift('commons');
      }

      aden.logger.debug('html plugin apply', {
        page: _.pick(page, ['entryName', 'resolved']),
      });

      const htmlPlugin = new HtmlWebpackPlugin({
        template: page.resolved.htmlFile,
        filename: `../${page.entryName}.html`,
        chunks,
        inject: page.inject,
        cache: false,
        title: page.title || page.name,
      });

      webpackConfig.plugins.push(htmlPlugin);
    }
  });

  return {
    key: 'html',
    version: '0.1.0',
  };
};
