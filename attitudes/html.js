const path = require('path')

module.exports = (attitude) => {
  const {
    ENTRY_STATIC,
    KEY_STRING
  } = attitude.constants

  // Allows .server { html: 'myentryname' },
  attitude.registerKey('html', {
    type: KEY_STRING,
    value: 'index',
    config: true,
    inherit: true
  })

  // TODO: Warn for overlapping static dist files like: [index.md, index.hbs] -> index.html

  attitude.registerFile(
    'htmlFile',
    ({ page, fileInfo }) => {
      return fileInfo.file.match(/\.html$/) && fileInfo.name === page.html.value
    },
    {
      entry: ENTRY_STATIC,
      distExt: '.html'
    }
  )

  attitude.hook('post:apply', ({ pages, webpackConfigs }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'))

    frontendConfig.resolve.extensions.push('.html')

    frontendConfig.module.rules.push({
      test: /\.html$/,
      include: [
        path.resolve(attitude.rootPath, '../node_modules'),
        path.resolve(attitude.rootPath, '../../node_modules')
      ].concat(attitude.flattenPages(pages).map((page) => page.path.resolved)),
      use: {
        loader: require.resolve('html-loader')
        // options: {
        //   minimize: !attitude.isDEV,
        // },
      }
    })
  })
}
