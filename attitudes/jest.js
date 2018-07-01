const jest = require('jest')

module.exports = function (attitude) {
  attitude.hook('test', (aden, page) => {
    jest.run({
      for: page.resolved,
      onSuite: (suite) => attitude.applyHook('run:suite', { suite })
    })
  })
  attitude.registerHook('run:suite')
}
