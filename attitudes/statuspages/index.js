const path = require('path');
const STATUS_CODES = [404, 500];

module.exports = (aden) => {
  const statusPages = {};

  const {
    KEY_BOOLEAN,
  } = aden.constants;

  aden.registerKey('isStatusPage', {
    type: KEY_BOOLEAN,
    value: false,
  });

  // aden.registerPage(path.resolve(__dirname, '404'), {
  //   id: 'status-404',
  //   mount: false,
  // });
  //
  // aden.hook('setup', () => {
  //   statusPages[404] = aden.getPage('status-404');
  // });

  aden.hook('pre:load', ({ page }) => {
    const pageCode = parseInt(page.name, 10);
    if (pageCode && STATUS_CODES.includes(pageCode)) {
      page.set('mount', false);
      page.set('isStatusPage', true);
      page.set('distSubPath', 'statuspages');
    }
  });

  aden.hook('setup:route', ({ page }) => {
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

  aden.hook('post:setup', ({ pages, app }) => {
    app.use((err, req, res, next) => {
      if (res.statusCode === 200) {
        res.status(err.status || 500);
      }
        
      const page = statusPages[res.statusCode] || statusPages[500];
      
      if (page) {
        return page.get(req, res, next);
      }
      
      next(err);
    });

    app.use(pages[0].basePath, (req, res, next) => {
      const page = statusPages[404];

      if (page) {
        res.status(404);
        return page.get(req, res, next);
      }
      
      next();
    });
  });
};
