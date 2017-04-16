module.exports = (/* aden, page */) => (req, res, page, data) => {
  res.json({ page, data });
};
