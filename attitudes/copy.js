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

  attitude.hook('apply', ({ page, webpackConfigs }) => {
    if (page.copy.value && page.copy.value.length > 0) {
      const frontendConfig = webpackConfigs
        .find((conf) => (conf.name === 'frontend'))

      const copyPatters = page.copy.value.map((pattern) => Object.assign(pattern, {
        context: page.path.resolved,
        to: path.resolve(
          attitude.settings.dist,
          page.distSubPath.value || 'public',
          page.relativePath,
          pattern.to || ''
        )
      }))

      frontendConfig.plugins.push(new CopyWebpackPlugin(
        copyPatters,
        page.copyOptions.value
      ))
    }
  })
}
