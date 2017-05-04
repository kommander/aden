const path = require('path');
const fs = require('fs');
const babel = require('babel-core');

// TODO: Currently broken... not sure how to integrate backend builds yet
module.exports = (aden) => {
  const build = (page, key) => {
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

    Object.assign(key, {
      dist: path.resolve(key.dir, `.dist${key.value}`),
    });

    const result = babel.transform(
      fs.readFileSync(key.resolved),
      {
        filename: key.value,
        extends: babelrcPath,
        moduleRoot: './',
        // Note: resolveModuleSource only works for amd modules
        resolveModuleSource: (source) => {
          if (source.match(/^\.\.?\//)) {
            return path.resolve(path.key.dir, `.dist${source}`);
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
  };

  aden.registerFiles('jsxFiles', /\.jsx$/, { key: { build } });
};
