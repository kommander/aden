const aden = require('../../lib/aden');
const http = require('http');
const path = require('path');
const expect = require('expect');
const request = require('supertest');
const Logger = require('../../lib/aden.logger');
const TestDuplex = require('../lib/test-duplex.js');
const spawn = require('../lib/spawn');
const ncp = require('ncp').ncp;
const os = require('os');

describe('Core Dev', () => {
  afterEach((done) => {
    spawn.anakin(done);
  });
  
  she('provides a startup callback', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('startup:callback', (data) => {
      expect(data).toBe('blub!');
    });

    adn.init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('takes existing http server instance', (done) => {
    const server = http.createServer();

    aden(server, { dev: true })
      .init(path.resolve(__dirname, '../tmpdata/emptypath'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server === server).toBe(true)
        an.shutdown(done)
      })
      .catch(done);
  });

  she('logs a warning when multiple dot server files are present', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('warn', (data) => {
      expect(data.msg).toMatch(/Multiple server config files, using/);
    });

    adn.init(path.resolve(__dirname, '../tmpdata/multidotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('logs an error for an invalid .server file', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);

    const adn = aden({
      dev: true,
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    });

    logParser.once('error', (err) => {
      expect(err.message).toMatch(/Unexpected token n in JSON at position/);
    });

    adn.init(path.resolve(__dirname, '../tmpdata/brokendotserver'))
      .then((an) => an.run('dev'))
      .then((an) => an.shutdown(done));
  });

  she('exposes aden.server in startup callback', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/startup'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('calls load hook only once per page', (done) => {
    const pagesLoaded = [];

    aden({ dev: true })
      .hook('load', ({ page }) => {
        if (pagesLoaded.includes(page.id)) {
          throw new Error('Page loaded multiple times');
        }
        pagesLoaded.push(page.id);
      })
      .init(path.resolve(__dirname, '../tmpdata/cssbase'))
      .then((an) => an.run('dev'))
      .then((an) => {
        an.shutdown(done);
      })
      .catch(done);
  });

  // TODO: Check if still required behaviour
  she.skip('does not create bundles for empty paths', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/emptypath'))
      .then((an) => an.run('dev'))
      .then((an) => {
        request(an.server)
          .get('/api/bundle.js')
          .end((err, res) => {
            if (err) done(err);
            expect(res.status).toBe(404);
            an.shutdown(done);
          });
      })
      .catch(done);
  });

  she('resolves default babel presets from aden node_modules', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/babel'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('resolves default babel presets (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel');
    // Node spawn does not handle .cmd/.bat on windows
    // -> https://github.com/nodejs/node-v0.x-archive/issues/2318
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        logParser.attach(child.stderr);
        logParser.on('ready', () => {
          logParser.destroy();
          done();
        });
      });
  });

  she('resolves default babel presets with options (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel5');
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel5'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        logParser.on('ready', () => {
          logParser.destroy();
          done();
        });
      });
  });

  she('still fails the build for non-resolved babel presets (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel3');
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel3'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        logParser.attach(child.stderr);
        logParser.on('webpack:build:errors', () => {
          logParser.destroy();
          done();
        });
      });
  });

  she('resolves default babel plugins from aden node_modules', (done) => {
    aden({ dev: true })
      .init(path.resolve(__dirname, '../tmpdata/babel2'))
      .then((an) => an.run('dev'))
      .then((an) => {
        expect(an.server).toBeAn('object');
        an.shutdown(done);
      })
      .catch(done);
  });

  she('resolves default babel plugins (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel2');
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel2'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        logParser.attach(child.stderr);
        let failed = false;
        logParser.on('webpack:build:errors', () => {
          logParser.destroy();
          failed = true;
          done(new Error('should not fail'));
        });
        logParser.on('ready', () => {
          logParser.destroy();
          !failed && done();
        });
      });
  });

  she('resolves default babel plugins with options (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel6');
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel6'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        let failed = false
        logParser.on('webpack:build:errors', () => {
          logParser.destroy();
          failed = true;
          done(new Error('should not fail'));
        });
        logParser.on('ready', () => {
          logParser.destroy();
          !failed && done();
        });
      });
  });

  she('still fails the build for non-resolved babel plugins (external path)', (done) => {
    const tmpTarget = path.resolve(os.tmpdir(), 'aden-test-babel4');
    const spawnCmd = /^win/.test(process.platform) ? 'aden.cmd' : 'aden';
    ncp(
      path.resolve(__dirname, '../tmpdata/babel4'),
      tmpTarget,
      (err) => {
        if (err) {
          done(err);
          return;
        }
        const child = spawn(spawnCmd, ['dev'], {
          cwd: tmpTarget,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = Logger.getLogParser();
        logParser.attach(child.stdout);
        logParser.attach(child.stderr);
        logParser.on('webpack:build:errors', () => {
          logParser.destroy();
          done();
        });
      });
  });

  she('calls startup hooks for subpages');

  // (static entry point templates go into public build)
  she('distincts between static and dynamic entry points');

  // docs/quotemachine/api/quote/quote.js
  she('clears the cache for changed modules used by controllers');

  she('// Things Aden already does but are untested...');
  she('takes ignores from .server, applied to subpath only');
  she('calls a build hook for keys marked as build');
  she('resolves dist and distFileName for keys marked as build');
  she('resolves dist and distFileName for file array keys marked as build');
  she('ignores dot files/folders for page parsing');
  she('does not expose bare assets from page tree');
});
