module.exports = (aden) => {
  aden.registerKey({
    name: 'js',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'jsFile',
    type: 'rpath',
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.(js|jsx)$/, ({ page, fileInfo }) => {
    if (fileInfo.name === page.html) {
      return Object.assign(page, {
        jsFile: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('apply', ({ page, webpackEntry }) => {
    if (page.jsFile) {
      webpackEntry.push(page.resolved.jsFile);
    }
  });

  return {
    key: 'js',
    version: '0.1.0',
  };
};
