module.exports = (aden) => {
  return (req, res, next) => {
    // console.log('Global example middleware. Added to all routes within this path.')
    next();
  }
}
