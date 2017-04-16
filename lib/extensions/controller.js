const fs = require('fs');
const path = require('path');
const babel = require('babel-core');

module.exports = (aden) => {
  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: allow match fn instead of regex
  // TODO: only execute plugin hooks if file was matched

  const build = (page, key) => {
    if (key.resolved.match(/\.jsx$/)) {
      // TODO: fix .babelrc resolve (add fileHandler and gather .babelrcs)
      const babelrcPath = [
        path.resolve(page.rootPath, '.babelrc'),
        path.resolve(page.rootPath, '../.babelrc'),
        path.resolve(page.rootPath, '../../.babelrc'),
      ]
      .find((rcPath) => {
        try {
          fs.accessSync(rcPath, fs.F_OK | fs.R_OK);
          return true;
        } catch (ex) {
          return false;
        }
      });

      // Note: resolveModuleSource only works for amd modules
      const result = babel.transform(
        fs.readFileSync(key.resolved),
        {
          filename: key.value,
          extends: babelrcPath,
          moduleRoot: './',
          resolveModuleSource: (source) => {
            if (source.match(/^\.\.?\//)) {
              return path.resolve(path.parse(key.resolved).dir, source);
            }
            return source;
          },
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
        ? aden.loadCustom(page.key.getPath.build && page.key.getPath.value
          ? page.key.getPath.dist
          : page.key.getPath.resolved, page)
        : page.get,
      post: page.key.postPath.resolved
        ? aden.loadCustom(page.key.postPath.build && page.key.postPath.value
          ? page.key.postPath.dist
          : page.key.postPath.resolved, page)
        : page.post,
      put: page.key.putPath.resolved
        ? aden.loadCustom(page.key.putPath.build && page.key.putPath.value
          ? page.key.putPath.dist
          : page.key.putPath.resolved, page)
        : page.put,
      delete: page.key.deletePath.resolved
        ? aden.loadCustom(page.key.deletePath.build && page.key.deletePath.value
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
