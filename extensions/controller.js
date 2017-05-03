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
      // TODO: Use page.controller('get', fn) -> warn when overwriting
      get: page.key.getPath.resolved
        ? aden.loadCustom(page.key.getPath, page)
        : page.get,
      post: page.key.postPath.resolved
        ? aden.loadCustom(page.key.postPath)
        : page.post,
      put: page.key.putPath.resolved
        ? aden.loadCustom(page.key.putPath)
        : page.put,
      delete: page.key.deletePath.resolved
        ? aden.loadCustom(page.key.deletePath)
        : page.delete,
    });
  });
};
