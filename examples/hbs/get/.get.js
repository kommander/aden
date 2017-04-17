module.exports = () => (req, res, page) =>
  res.send(page.key.templates.value.hello.render({
    name: 'Aden',
  })
);
