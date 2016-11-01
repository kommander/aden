const pug = require('pug');

module.exports = () => (file, content) => {
  const templateFn = pug.compile(content, {
    filename: file,
  });
  return {
    fn: templateFn,
    type: 'pug',
  };
};
