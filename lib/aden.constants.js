const _ = require('lodash');

// TODO: Generate automatic validation for .server file settings
const keyTypes = {
  ENTRY_TYPE_STATIC: 'static',
  ENTRY_TYPE_DYNAMIC: 'dynamic',
  KEY_TYPE_OBJECT: 'object',
  KEY_TYPE_STRING: 'string',
  KEY_TYPE_STRING_ARRAY: 'stringarray',
  KEY_TYPE_BOOLEAN: 'bool',
  KEY_TYPE_FUNCTION: 'function',
  KEY_TYPE_RPATH: 'rpath',
  KEY_TYPE_FILE: 'file',
  KEY_TYPE_FILE_ARRAY: 'filearray',
  KEY_TYPE_ARRAY: 'array',
  KEY_TYPE_CUSTOM: 'custom',
  KEY_TYPE_APATH: 'apath',
  KEY_TYPE_DIST_PATH: 'dpath', // Will be resolved relative to .dist
  KEY_TYPE_PAGE_PATH: 'pagepath',
  KEY_TYPE_WEBPACK: 'webpack',
};

const allowedKeyTypes = Object.keys(keyTypes).map((key) => keyTypes[key]);

module.exports = _.extend(
  keyTypes,
  {
    allowedKeyTypes,
  }
);
