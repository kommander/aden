module.exports = () => [
  (req, res, next) => {
    if (req.query.a === 'b') {
      return next();
    }
    const err = new Error('unauthorized');
    err.status = 403;
    return next(err);
  },
  (req, res, page) => res.send(`Page Name: ${page.name}`),
];
