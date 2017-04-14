module.exports = (aden) => {
  aden.registerKey({
    name: 'getFile',
    type: 'string',
    default: '.get.js',
  });

  aden.registerKey({
    name: 'getPath',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: allow match fn instead of regex
  // TODO: register with key name, always as rpath, inherit false
  //       only execute plugin hooks if file was matched
  aden.registerFile(/\.js$/, ({ page, fileInfo }) => {
    if (fileInfo.file === page.getFile) {
      Object.assign(page, {
        getPath: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('setup:route', ({ page }) => {
    if (page.resolved.getPath) {
      Object.assign(page, {
        get: aden.loadCustom(page.resolved.getPath, page),
      });
    }
  });

  return {
    key: 'controller',
    version: '0.1.0',
  };
};
