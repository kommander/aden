const fs = require('fs');
const path = require('path');
const babel = require('babel-core');

module.exports = (aden) => {
  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: allow match fn instead of regex
  // TODO: only execute plugin hooks if file was matched

  const build = (page, key) => {
    if (key.resolved.match(/\.jsx$/)) {
      const result = babel.transform(
        fs.readFileSync(key.resolved),
        {
          extends: path.resolve(page.rootPath, '.babelrc'),
        }
      );

      return new Promise((resolve, reject) =>
        fs.writeFile(
          key.dist,
          result.code,
          (err) => (err ? reject(err) : resolve(key))
        )
      );
    }
    return Promise.resolve(key);
  };

  aden.registerFile('getPath', /\.get\.jsx?$/, { key: { build } });
  aden.registerFile('postPath', /\.post\.jsx?$/, { key: { build } });
  aden.registerFile('putPath', /\.put\.jsx?$/, { key: { build } });
  aden.registerFile('deletePath', /\.delete\.jsx?$/, { key: { build } });

  aden.hook('setup:route', ({ page }) => {
    Object.assign(page, {
      get: page.key.getPath.resolved
        ? aden.loadCustom(page.key.getPath.resolved, page)
        : page.get,
      post: page.key.postPath.resolved
        ? aden.loadCustom(page.key.postPath.resolved, page)
        : page.post,
      put: page.key.putPath.resolved
        ? aden.loadCustom(page.key.putPath.resolved, page)
        : page.put,
      delete: page.key.deletePath.resolved
        ? aden.loadCustom(page.key.deletePath.resolved, page)
        : page.delete,
    });
  });

  return {
    key: 'controller',
    version: '0.2.0',
  };
};
