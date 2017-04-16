const fs = require('fs');
const path = require('path');

module.exports = (aden) => {
  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: allow match fn instead of regex
  // TODO: only execute plugin hooks if file was matched

  aden.registerFile('getPath', /\.get\.jsx?$/);
  aden.registerFile('postPath', /\.post\.jsx?$/);
  aden.registerFile('putPath', /\.put\.jsx?$/);
  aden.registerFile('deletePath', /\.delete\.jsx?$/);

  aden.hook('apply', ({ webpackConfigs, page }) => {
    ['getPath', 'postPath', 'putPath', 'deletePath']
      .filter((method) => page.key[method].value)
      .forEach((method) =>
        Object.assign(webpackConfigs.backend.entry, {
          [page.key[method].distFileName]: [page.key[method].dist],
        })
      );
  });

  aden.hook('setup:route', ({ page }) => {
    Object.assign(page, {
      get: page.key.getPath.resolved
        ? aden.loadCustom(page.key.getPath.value
          ? page.key.getPath.dist
          : page.key.getPath.resolved, page)
        : page.get,
      post: page.key.postPath.resolved
        ? aden.loadCustom(page.key.postPath.value
          ? page.key.postPath.dist
          : page.key.postPath.resolved, page)
        : page.post,
      put: page.key.putPath.resolved
        ? aden.loadCustom(page.key.putPath.value
          ? page.key.putPath.dist
          : page.key.putPath.resolved, page)
        : page.put,
      delete: page.key.deletePath.resolved
        ? aden.loadCustom(page.key.deletePath.value
          ? page.key.deletePath.dist
          : page.key.deletePath.resolved, page)
        : page.delete,
    });
  });

  return {
    key: 'controller',
    version: '0.2.0',
  };
};
