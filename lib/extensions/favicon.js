const fs = require('fs');

module.exports = (aden) => {
  aden.registerKey({
    name: 'favicon',
    type: 'rpath',
  });

  aden.registerFile(/favicon\.ico$/, ({ page, fileInfo }) =>
    Object.assign(page, {
      favicon: fileInfo.rpath,
    })
  );

  aden.hook('setup', ({ rootPage, app }) => {
    const faviconRoute = `${rootPage.basePath}favicon.ico`;
    const favicon = fs.readFileSync(rootPage.resolved.favicon);

    app.use(faviconRoute, (req, res) => {
      res.setHeader('Content-Type', 'image/x-icon');
      res.send(favicon);
    });
  });

  return {
    key: 'favicon',
    version: '0.1.0',
  };
};
