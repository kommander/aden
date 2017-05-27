// The /api path should give a 404, while /api/user should send this
module.exports = () => (req, res) => res.send('userapi');
