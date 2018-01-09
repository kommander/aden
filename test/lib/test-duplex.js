const Duplex = require('stream').Duplex

class TestDuplex extends Duplex {
  _write (data, enc, next) {
    this.emit('data', data)
    next()
  }
  _read () {}
}

module.exports = TestDuplex
