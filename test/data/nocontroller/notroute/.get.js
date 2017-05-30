// when .server { route: false }, the page router will not be hooked up,
// so this should get sent on a page GET request
module.exports = () => (req, res) => res.send('noroute');
