module.exports = (aden) => {
  aden.registerKey({
    name: 'css',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'cssFile',
    type: 'rpath',
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.css$/, ({ page, fileInfo }) => {
    if (fileInfo.name === page.css) {
      return Object.assign(page, {
        cssFile: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.cssFile) {
      webpackEntry.push(page.resolved.cssFile);
    }
  });

  return {
    key: 'css',
    version: '0.1.0',
  };
};
