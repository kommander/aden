'use strict';

const _ = require('lodash');

const adenConstants = require('./aden.constants.js');
const {
  KEY_FILE_ARRAY,
  KEY_FILE,
} = adenConstants;

class Attitude {
  constructor(aden, name, location) {
    this.aden = aden;
    this.name = name;
    this.location = location;
    this.keys = [];
    this.fileHandlers = [];
    this.log = aden.log.namespace(`attitude-${name}`);
    this.constants = adenConstants;

    ['hook', 'registerPage', 'loadCustom', 'getPage']
      .forEach((methodName) => Object.assign(this, {
        [methodName]: (...args) => aden[methodName](...args),
      }));

    _.extend(this, _.pick(aden, [
      'name', 'app', 'version', 'rootPath', 'rootPage', 'walkPages',
      'isDEV', 'isPROD', 'flattenPages', 'server', 'settings',
    ]));
  }

  registerFiles(keyName, regex, opts = {}) {
    return this.registerFile(keyName, regex, _.extend(opts, {
      type: KEY_FILE_ARRAY,
    }));
  }

  registerFile(keyName, regex, opts = {}) {
    this.registerKey(keyName, _.extend({
      type: KEY_FILE,
    }, opts, {
      inherit: false,
    }));

    const handler = {
      keyName,
      matcher: ({ page, fileInfo }) => (typeof regex === 'function'
        ? regex({ page, fileInfo })
        : fileInfo.file.match(regex)
      ),
      fn: ({ page, fileInfo, key }) => {
        Object.assign(key, {
          value: key.type === KEY_FILE_ARRAY
            ? (key.value || []).concat(fileInfo)
            : fileInfo.rpath,
        });

        if (typeof opts.handler === 'function') {
          opts.handler({ page, fileInfo, key });
        }
        return { page, fileInfo, key };
      },
    };

    this.fileHandlers.push(handler);

    return this;
  }

  /**
   * Adding a key to the page which can be used by attitudes to add information
   * the attitude needs to handle the page. Files are registered as `file` type keys
   * and follow the same basic behaviour as all other keys.
   * This mechanism is used to avoid attitudes messing with each other
   * and should provide a convenient interface to handle and load
   * already resolved resources for a page.
   *
   * Example:
   * The `hbs` attitue registers the key `templates`, to allow access to
   * render methods like `page.templates.hello.render(...)`.
   */
  registerKey(name, key = {}) {
    const newKey = this.aden.createKey(name, key);

    // TODO: Check for colliding keys (also check if default keys are colliding)
    this.keys.push(newKey);

    return this;
  }

  applyTo(page) {
    this.aden.applyKeysToPage(page, this.keys);
    Object.assign(page, {
      fileHandlers: page.fileHandlers.concat(this.fileHandlers),
    });
  }
}

module.exports = Attitude;
