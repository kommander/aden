module.exports = () => (req, res, page) =>
  page.templates.value.hello.render({
    name: 'Aden',
  })
  .then((result) => res.send(result))
;
