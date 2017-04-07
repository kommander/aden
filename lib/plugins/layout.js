//
// Aden Layout Plugin
//
const conflate = require('conflate');

// TODO: Use .getWorker(appModule, config)
//       (Use this to auto scale paths that take a lot of traffic,
//       by adding a proxy to this path, routing it to a separate worker process,
//       or a cluster on another ip/vip)

function setupPlugin(aden) {
  aden.hook('pre:load', (args) => {
    // TODO: Avoid using aden as a global space
    const rootConfig = args.aden.rootConfig;
    rootConfig.commons = false;
  });

  // TODO: Split this out to remote_layout.js plugin when plugin order is implemented (.aden)
  // Provide Remote Layout (Only root level layouts will be served)
  aden.hook('pre:setup', (args) => {
    const router = args.router;

    router.use('/_layout', (req, res, next) => {
      const parts = req.path.split(/\//);
      const layoutName = parts[parts.length - 1];
      // const layoutVersion = parts[parts.length - 2];
      const layoutPage = args.rootPage.layouts ? args.rootPage.layouts[layoutName] : null;
      const data = {
        body: '{{{body}}}',
      };
      if (layoutPage) {
        aden.renderPage(req, res, layoutPage, data)
          .then(result => {
            res.send({
              html: result.html,
              data: result.data,
            });
          })
          .catch(err => next(err));
        return;
      }
      next();
    });
  });

  aden.hook('pre:parse', (args) => {
    const page = args.page;
    page.layout = args.parentPage.layout || 'default';
    page.layouts = conflate({}, args.parentPage.layouts || {});
    page.layoutDir = args.parentPage.layoutDir || '.layout';
  });

  aden.hook('post:parse', (args) => {
    const page = args.page;
    const layoutPage = page.layouts[page.layout];
    if (!layoutPage) {
      page.commons = true;
    }
  });

  aden.hook('parse:dot', (args) => {
    const page = args.page;

    if (args.file === page.layoutDir) {
      return Promise.resolve()
        .then(() => aden.parsePage(args.fullFilePath, conflate({}, page, {
          commons: true, inject: 'head',
        })))
        .then(layoutHolder => {
          layoutHolder.children.forEach((layout) => {
            conflate(layout, {
              layout: null,
              route: null,
              render: aden.getDefaultRender(),
            });
            page.layouts[layout.name] = layout;
            page.children.push(layout);
          });
        });
    }

    return Promise.resolve(args);
  });

  aden.hook('post:render', (args) => {
    const layoutPage = args.page.layouts[args.page.layout];

    if (layoutPage && args.page.layout !== null) {
      args.data.body = args.html; // eslint-disable-line
      return aden.renderPage(args.req, args.res, layoutPage, args.data)
        .then(layoutResult => {
          args.html = layoutResult.html; // eslint-disable-line
        });
    }
    // TODO: Straighten out render pipeline
    return Promise.resolve(args);
  });
}

module.exports = setupPlugin;
