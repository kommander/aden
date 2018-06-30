'use strict'

// TODO: Generate automatic validation for .server file settings
const keyTypes = {
  KEY_PATH: 'config.setting', // either absolute or relative to root
  KEY_PAGE: 'page',
  KEY_OBJECT: 'object',
  KEY_STRING: 'string',
  KEY_STRING_ARRAY: 'stringarray',
  KEY_BOOLEAN: 'bool',
  KEY_FUNCTION: 'function',
  KEY_RPATH: 'rpath',
  KEY_FILE: 'file',
  KEY_FILE_ARRAY: 'filearray',
  KEY_ARRAY: 'array',
  KEY_CUSTOM: 'custom',
  KEY_APATH: 'apath',
  KEY_PAGE_PATH: 'pagepath',
  KEY_PAGE_PATH_ARRAY: 'pagepatharray'
}
const allowedKeyTypes = Object.keys(keyTypes).map((key) => keyTypes[key])

module.exports = {
  ...keyTypes,
  ...{
    allowedKeyTypes
  }
}
