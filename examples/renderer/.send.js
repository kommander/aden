module.exports = () => (req, res, page, data) => {
  res.json({ page, data });
};
