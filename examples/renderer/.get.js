// TODO: Ensure the .file includes are in page scope
module.exports = (aden, page) => (req, res, page, data) => {
  res.json({ page, data });
};
