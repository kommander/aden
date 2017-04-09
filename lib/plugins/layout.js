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
    rootConfig.commons = true;
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
    page.foundLayouts = [];
  });

  aden.hook('parse:dot', ({ page, fullFilePath, file }) => {
    if (file === page.layoutDir) {
      page.foundLayouts.push(fullFilePath);
    }
    return Promise.resolve({ page, fullFilePath, file });
  });

  aden.hook('post:parse', ({ page }) => {
    return Promise.all(page.foundLayouts.map((fullFilePath) => {
      return aden.parsePage(fullFilePath, Object.assign(page, {
        commons: true, inject: 'head',
      }))
      .then((parsedPage) => aden.executeDotFiles([parsedPage]))
      .then(([parsedPage]) => {
        const layoutPage = parsedPage.layouts[parsedPage.layout];

        if (!layoutPage) {
          parsedPage.commons = true;
        }

        (parsedPage.children || []).forEach((layout) => {
          conflate(layout, {
            layout: null,
            route: null,
            render: aden.getDefaultRender(),
          });

          parsedPage.layouts[layout.name] = layout;
          parsedPage.children.push(layout);

          return { page: parsedPage };
        });
      });
    }));
  });

  aden.hook('post:render', ({ page, html, data, req, res }) => {
    const layoutPage = page.layouts[page.layout];

    if (layoutPage && page.layout !== null) {
      data.body = html; // eslint-disable-line
      return aden.renderPage(req, res, layoutPage, data)
        .then(layoutResult => {
          html = layoutResult.html; // eslint-disable-line
        });
    }
    // TODO: Straighten out render pipeline
    return Promise.resolve({ page, html, data, req, res });
  });
}

module.exports = setupPlugin;