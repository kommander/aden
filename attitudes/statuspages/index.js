const path = require('path');
const STATUS_CODES = [404, 500];

module.exports = (aden) => {
  const statusPages = {};
  const defaultPages = {};
  const defaultStatusCodes = [404, 500]

  const {
    KEY_BOOLEAN,
  } = aden.constants;

  aden.registerKey('isStatusPage', {
    type: KEY_BOOLEAN,
    value: false,
  });

  aden.registerKey('statusDefaults', {
    type: KEY_BOOLEAN,
    value: true,
    config: true,
  });

  aden.hook('init', ({ rootPage }) => {
    if (rootPage.statusDefaults.value === true) {
      return Promise.all(defaultStatusCodes.map((status) => 
        aden.loadPage(path.resolve(__dirname, `${status}`), {
          id: `default-status-${status}`,
          mount: false,
          distSubPath: 'statuspages',
        }) 
      ));
    }
  });

  aden.hook('pre:load', ({ page }) => {
    const pageCode = parseInt(page.name, 10);
    if (pageCode 
      && !page.id.match(/default-status-/)
      && STATUS_CODES.includes(pageCode)) {
      page.set('mount', false);
      page.set('isStatusPage', true);
      page.set('distSubPath', 'statuspages');
    }
  });

  function ensureController(page) {
    if (page && !page.get && page.staticMain.value) {
      const staticMainFile = page[page.staticMain.value];
      Object.assign(page, {
        get: (req, res) =>
          staticMainFile
            .load()
            .then((buffer) => res.send(buffer.toString('utf8'))),
      });
    }
  }

  aden.hook('setup', () => {
    const pages = [
      aden.getPage('default-status-404'),
      aden.getPage('default-status-500'),
    ];
    pages
      .filter((page) => !!page)
      .forEach((page) => {
        page.set('mount', false);
        page.set('distSubPath', 'statuspages');
      });
    ensureController(pages[0]);
    ensureController(pages[1]);
    defaultPages[404] = pages[0];
    defaultPages[500] = pages[1];
  });

  aden.hook('post:setup', ({ pages, app }) => {
    pages.forEach((page) => {
      if (page.isStatusPage.value) {
        if (statusPages[parseInt(page.name, 10)]) {
          aden.log.warn(`Status page ${page.name} already set.`);
          return;
        }

        ensureController(page);

        if (page.get) {
          statusPages[parseInt(page.name, 10)] = page;
        }
      }
    });
    
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
