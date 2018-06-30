const { createServer } = require('http')
module.exports = {
  startup: () => {
    const server = createServer((req, res) => {
      res.end(1)
    });
    server.listen()
  }
}