const path = require('path');
const STATUS_CODES = [404, 500];

module.exports = (aden) => {
  const statusPages = {};
  const defaultPages = {};

  const {
    KEY_BOOLEAN,
  } = aden.constants;

  aden.registerKey('isStatusPage', {
    type: KEY_BOOLEAN,
    value: false,
  });

  aden.hook('init', () => {
    return Promise.all([
      aden.loadPage(path.resolve(__dirname, '404'), {
        id: 'status-404',
      }),
      aden.loadPage(path.resolve(__dirname, '500'), {
        id: 'status-500',
      }), 
    ])
    .then((pages) => {
      pages.forEach((page) => {
        page.set('isStatusPage', true);
        page.set('mount', false);
        page.set('distSubPath', 'statuspages');
      });
      defaultPages[404] = pages[0];
      defaultPages[500] = pages[1];
    });
  });

  aden.hook('pre:load', ({ page }) => {
    const pageCode = parseInt(page.name, 10);
    if (pageCode && STATUS_CODES.includes(pageCode)) {
      page.set('mount', false);
      page.set('isStatusPage', true);
      page.set('distSubPath', 'statuspages');
    }
  });

  function ensureController(page) {
    if (!page.get && page.staticMain.value) {
      const staticMainFile = page[page.staticMain.value];
      Object.assign(page, {
        get: (req, res) =>
          staticMainFile
            .load()
            .then((buffer) => res.send(buffer.toString('utf8'))),
      });
    }
  }

  aden.hook('post:apply', ({ pages }) => {
    pages.forEach((page) => {
      if (page.isStatusPage.value) {
        if (statusPages[parseInt(page.name, 10)]) {
          aden.log.warn(`Status page ${page.name} already set.`);
          return;
        }

        if (!page.get && page.staticMain.value) {
          const staticMainFile = page[page.staticMain.value];
          Object.assign(page, {
            get: (req, res) =>
              staticMainFile
                .load()
                .then((buffer) => res.send(buffer.toString('utf8'))),
          });
        }

        if (page.get) {
          statusPages[parseInt(page.name, 10)] = page;
        }
      }
    });
  });

  aden.hook('post:setup', ({ pages, app }) => {
    app.use((err, req, res, next) => {
      if (res.statusCode === 200) {
        res.status(err.status || 500);
      }
        
      const page = statusPages[res.statusCode] || statusPages[500] || defaultPages[500];
      
      if (page) {
        Object.assign(res, {
          data: err,
        });
        return page.get(req, res, next);
      }
      
      next(err);
    });

    app.use(pages[0].basePath, (req, res, next) => {
      const page = statusPages[404] || defaultPages[404];

      if (page) {
        res.status(404);
        return page.get(req, res, next);
      }
      
      next();
    });
  });
};
