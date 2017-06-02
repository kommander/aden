'use strict';

/**
 * Attitude
 * Encapsulates server behaviour, using _hooks_ and _keys_.
 *
 * This mechanism is used to avoid attitudes messing with each other
 * and should provide a convenient interface to handle and load
 * already resolved resources for a page.
 *
 * Example:
 * Use an Attitude to register an object key that setable via .server.
 * ```
 * const extension = new Attitude(aden, );
 * ```
 */
  
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

    ['hook', 'registerPage', 'loadWrappedFn', 'getPage']
      .forEach((methodName) => Object.assign(this, {
        [methodName]: (...args) => aden[methodName](...args),
      }));

    _.extend(this, _.pick(aden, [
      'name', 'app', 'version', 'rootPath', 'rootPage', 'walkPages',
      'isDEV', 'flattenPages', 'server', 'settings',
      'supportedMethods',
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
