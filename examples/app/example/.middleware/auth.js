module.exports = (aden) => {
  return (req, res, next) => {
    // console.log('Local example middleware. Added to all routes within this path.')
    if (req.query.secret === 'aden') {
      next();
      return;
    }
    res.sendStatus(401);
  }
}
