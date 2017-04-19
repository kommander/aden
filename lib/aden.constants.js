const _ = require('lodash');

const keyTypes = {
  KEY_TYPE_STRING: 'string',
  KEY_TYPE_RPATH: 'rpath',
  KEY_TYPE_FILE: 'file',
  KEY_TYPE_CONFIG: 'config',
  KEY_TYPE_FILE_ARRAY: 'filearray',
  KEY_TYPE_CUSTOM: 'custom',
  KEY_TYPE_PAGE_PATH: 'pagepath',
};

const allowedKeyTypes = Object.keys(keyTypes).map((key) => keyTypes[key]);

module.exports = _.extend(
  keyTypes,
  {
    allowedKeyTypes,
  }
);
