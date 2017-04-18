const fs = require('fs');

module.exports = (aden) => {
  aden.registerFile('favicon', /favicon\.ico$/);

  aden.hook('setup', ({ rootPage, app }) => {
    if (rootPage.key.favicon.resolved) {
      const faviconRoute = `${rootPage.basePath}favicon.ico`;
      const favicon = fs.readFileSync(rootPage.key.favicon.resolved);

      app.use(faviconRoute, (req, res) => {
        res.setHeader('Content-Type', 'image/x-icon');
        res.send(favicon);
      });
    }
  });

  return {
    key: 'favicon',
    version: '0.1.0',
  };
};
