module.exports = (aden) => {
  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: only execute plugin hooks if file was matched

  aden.registerFile('getPath', /\.get\.jsx?$/, { key: {
    build: false,
    watch: true,
  } });
  aden.registerFile('postPath', /\.post\.jsx?$/, { key: {
    build: false,
    watch: true,
  } });
  aden.registerFile('putPath', /\.put\.jsx?$/, { key: {
    build: false,
    watch: true,
  } });
  aden.registerFile('deletePath', /\.delete\.jsx?$/, { key: {
    build: false,
    watch: true,
  } });

  aden.hook('load', ({ page }) => {
    Object.assign(page, {
      get: page.key.getPath.resolved
        ? aden.loadCustom(page.key.getPath.value && page.key.getPath.build
          ? page.key.getPath.dist
          : page.key.getPath.resolved, page)
        : page.get,
      post: page.key.postPath.resolved
        ? aden.loadCustom(page.key.postPath.value && page.key.postPath.build
          ? page.key.postPath.dist
          : page.key.postPath.resolved, page)
        : page.post,
      put: page.key.putPath.resolved
        ? aden.loadCustom(page.key.putPath.value && page.key.putPath.build
          ? page.key.putPath.dist
          : page.key.putPath.resolved, page)
        : page.put,
      delete: page.key.deletePath.resolved
        ? aden.loadCustom(page.key.deletePath.value && page.key.deletePath.build
          ? page.key.deletePath.dist
          : page.key.deletePath.resolved, page)
        : page.delete,
    });
  });

  return {
    key: 'controller',
    version: '0.2.1',
  };
};
