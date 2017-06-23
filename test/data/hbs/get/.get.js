module.exports = () => (req, res, page) =>
  res.send(page.templates.value.hello.render({
    name: 'Aden',
  })
);
