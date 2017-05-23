const STATUS_CODES = [404, 500];

module.exports = (aden) => {
  const statusPages = {};

  const {
    KEY_TYPE_BOOLEAN,
  } = aden.constants;

  aden.registerKey('isStatusPage', {
    type: KEY_TYPE_BOOLEAN,
    value: false,
  });

  aden.hook('pre:load', ({ page }) => {
    const pageCode = parseInt(page.name, 10);
    if (pageCode && STATUS_CODES.includes(pageCode)) {
      Object.assign(page, { route: false });
      Object.assign(page.keys.find((k) => (k.name === 'isStatusPage')), {
        value: true,
      });
      Object.assign(page.keys.find((k) => (k.name === 'distSubPath')), {
        value: 'statuspages',
      });
    }
  });

  aden.hook('setup:route', ({ page }) => {
    if (page.key.isStatusPage.value) {
      if (statusPages[page.name]) {
        aden.log.warn(`Status page ${page.name} already set.`);
        return;
      }

      if (!page.get && page.key.staticMain.value) {
        const staticMainFile = page.key[page.key.staticMain.value];
        Object.assign(page, {
          get: (req, res) =>
            staticMainFile
              .load()
              .then((buffer) => res.send(buffer.toString('utf8'))),
        });
      }

      if (page.get) {
        statusPages[page.name] = page;
      }
    }
  });

  aden.hook('route:error', ({ req, res, next }) => {
    const page = statusPages[res.statusCode];
    if (page) {
      return page.get(req, res, next);
    }
    return null;
  });

  aden.hook('route:notFound', ({ req, res, next }) => {
    const page = statusPages['404'];
    if (page) {
      return page.get(req, res, next);
    }
    return null;
  });
};
