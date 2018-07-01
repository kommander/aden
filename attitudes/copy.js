const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = (attitude) => {
  const {
    KEY_ARRAY,
    KEY_OBJECT
  } = attitude.constants

  // Allows .server { copy: [{ from: ..., to: ... }] },
  // -> https://github.com/kevlened/copy-webpack-plugin
  // -> it applies the page context to each plugin
  attitude.registerKey('copy', {
    type: KEY_ARRAY,
    value: [],
    config: true
  })

  attitude.registerKey('copyOptions', {
    type: KEY_OBJECT,
    value: {},
    config: true
  })
}
