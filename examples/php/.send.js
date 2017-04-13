const shelljs = require('shelljs');
const _ = require('lodash');

const sender = (req, res, page) => {
  page.logger.debug('PHP Sender', {
    page: _.pick(page, ['resolved', 'indexFile', 'templateFile', 'styleFile']),
  });

  const result = shelljs.exec(`php ${page.resolved.path}/index.php`);
  res.send(result.output);
};

module.exports = () => {
  if (!shelljs.which('php')) {
    throw new Error('No PHP installed');
  }
  return sender;
};
