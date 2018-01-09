const path = require('path')
const fs = require('fs')

const checkAccessMulti = function (pagePath, files) {
  return files
    .map((file) => path.resolve(pagePath, file))
    .filter((filePath) => {
      try {
        fs.accessSync(filePath, fs.F_OK | fs.R_OK)
        return true
      } catch (ex) {
        return false
      }
    })
}

// Use this to avoid problems with app level components messing with require.
// It allows app modules to change require,
// but will use default extensions for aden core.
// CHECK: [standard] 'require.extensions' was deprecated since v0.12.
// Use compiling them ahead of time instead. (node/no-deprecated-api)
const rExtensions = Object.assign({}, require.extensions)
const _nativeRequire = require
const nativeRequire = (request) => {
  Object.assign(_nativeRequire.extensions, rExtensions)
  return _nativeRequire(request)
}

const loadNativeOrJSON = function (filePath) {
  let config
  if (filePath.match(/\..*?\..*?$/)) {
    config = nativeRequire(filePath)
  } else {
    const configContent = fs.readFileSync(filePath)
    if (configContent.length > 0) {
      config = JSON.parse(configContent)
    } else {
      config = {}
    }
  }
  return config
}

module.exports = {
  checkAccessMulti,
  nativeRequire,
  loadNativeOrJSON
}
