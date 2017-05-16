const quote = require('./quote');
module.exports = () => (req, res) => res.json(quote());
