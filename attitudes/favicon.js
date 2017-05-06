const fs = require('fs');

module.exports = (aden) => {
  aden.registerFile('favicon', /favicon\.ico$/);

  aden.hook('setup', ({ app, pages }) => {
    if (pages[0].key.favicon.resolved) {
      const faviconRoute = `${pages[0].basePath}favicon.ico`;
      const favicon = fs.readFileSync(pages[0].rootPage.key.favicon.resolved);

      app.use(faviconRoute, (req, res) => {
        res.setHeader('Content-Type', 'image/x-icon');
        res.send(favicon);
      });
    }
  });
};
