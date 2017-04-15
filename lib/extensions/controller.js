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

  aden.registerKey({
    name: 'postFile',
    type: 'string',
    default: '.post.js',
  });

  aden.registerKey({
    name: 'postPath',
    type: 'rpath',
    inherit: false,
  });

  aden.registerKey({
    name: 'putFile',
    type: 'string',
    default: '.put.js',
  });

  aden.registerKey({
    name: 'putPath',
    type: 'rpath',
    inherit: false,
  });

  aden.registerKey({
    name: 'deleteFile',
    type: 'string',
    default: '.delete.js',
  });

  aden.registerKey({
    name: 'deletePath',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  // TODO: allow match fn instead of regex
  // TODO: register with key name, always as rpath, inherit false
  //       only execute plugin hooks if file was matched
  aden.registerFile(/\.get\.js$/, ({ page, fileInfo }) => {
    Object.assign(page, {
      getPath: fileInfo.rpath,
    });

    return page;
  });

  aden.registerFile(/\.post\.js$/, ({ page, fileInfo }) => {
    Object.assign(page, {
      postPath: fileInfo.rpath,
    });

    return page;
  });

  aden.registerFile(/\.put\.js$/, ({ page, fileInfo }) => {
    Object.assign(page, {
      putPath: fileInfo.rpath,
    });

    return page;
  });

  aden.registerFile(/\.delete\.js$/, ({ page, fileInfo }) => {
    Object.assign(page, {
      deletePath: fileInfo.rpath,
    });

    return page;
  });

  aden.hook('setup:route', ({ page }) => {
    Object.assign(page, {
      get: page.resolved.getPath ? aden.loadCustom(page.resolved.getPath, page) : page.get,
      post: page.resolved.postPath ? aden.loadCustom(page.resolved.postPath, page) : page.post,
      put: page.resolved.putPath ? aden.loadCustom(page.resolved.putPath, page) : page.put,
      delete: page.resolved.deletePath
        ? aden.loadCustom(page.resolved.deletePath, page) : page.delete,
    });
  });

  return {
    key: 'controller',
    version: '0.1.0',
  };
};
