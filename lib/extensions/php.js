// Note: this is for development purposes only and may move to a cgi plugin

const shelljs = require('shelljs');
const _ = require('lodash');

const sender = (req, res, page) => {
  page.logger.debug('PHP Sender', {
    page: _.pick(page, ['resolved', 'indexFile', 'templateFile', 'styleFile']),
  });

  const result = shelljs.exec(`php ${page.resolved.path}/index.php`);
  res.send(result.output);
};

module.exports = (plugin) => {
  if (!shelljs.which('php')) {
    plugin.logger.error('No PHP installed.');
    return;
  }

  plugin.hook('post:parse', ({ page, files }) => {
    const candidates = files
      .filter((file) => file === 'index.php');

    if (!page.template && candidates.length > 0) {
      Object.assign(page, {
        get: sender,
      });
    }
  });
};
