module.exports = (aden) => {
  // QUESTION: only execute plugin hooks if file was matched?

  // TODO: Cover other http methods:
  // checkout, copy, delete, get, head, lock, merge, mkactivity, mkcol, move,
  // m-search, notify, options, patch, post, purge, put, report, search,
  // subscribe, trace, unlock, unsubscribe

  aden
    .registerFile('getPath', /\.get\.jsx?$/, {
      build: false,
      watch: true,
    })
    .registerFile('postPath', /\.post\.jsx?$/, {
      build: false,
      watch: true,
    })
    .registerFile('putPath', /\.put\.jsx?$/, {
      build: false,
      watch: true,
    })
    .registerFile('deletePath', /\.delete\.jsx?$/, {
      build: false,
      watch: true,
    })
    .registerFile('allPath', /\.all\.jsx?$/, {
      build: false,
      watch: true,
    });

  aden.hook('load', ({ page }) => {
    Object.assign(page, {
      // TODO: Use page.controller('get', fn) -> warn when overwriting
      get: page.getPath.resolved
        ? aden.loadCustom(page.getPath, page)
        : page.get,
      post: page.postPath.resolved
        ? aden.loadCustom(page.postPath, page)
        : page.post,
      put: page.putPath.resolved
        ? aden.loadCustom(page.putPath, page)
        : page.put,
      delete: page.deletePath.resolved
        ? aden.loadCustom(page.deletePath, page)
        : page.delete,
      all: page.allPath.resolved
        ? aden.loadCustom(page.allPath, page)
        : page.all,
    });
  });
};
