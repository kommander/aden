const aden = require('../../lib/aden');
const logger = require('../../lib/aden.logger');
const spawn = require('child_process').spawn;
const path = require('path');
const expect = require('expect');

describe('CLI', () => {
  she('has a dev mode cli command', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/basics'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logParser = logger.getLogParser();
    logParser.attach(child.stdout);
    logParser.on('listening', () => child.kill());
    child.on('error', done);
    child.on('exit', () => {
      logParser.destroy();
      done();
    });
  });

  she('has a start (production mode) cli command', (done) => {
    aden()
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => {
        const child = spawn('node', ['index.js', 'start', 'test/tmpdata/basics'], {
          cwd: path.resolve(__dirname, '../../'),
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const logParser = logger.getLogParser();    
        logParser.attach(child.stdout);
        logParser.on('listening', () => child.kill());
        child.on('error', () => {
          logParser.destroy();
          done();
        });
        child.on('exit', () => {
          an.shutdown(done);
        });
      });
  });

  she('has a build cli command', (done) => {
    const child = spawn('node', ['index.js', 'build', 'test/tmpdata/basics'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logParser = logger.getLogParser();
    logParser.attach(child.stdout);
    child.on('error', () => {
      logParser.destroy();
      done();
    });
    child.on('exit', () => {
      logParser.destroy();
      done();
    });
  });

  she('logs error if no .server file at root folder', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/nodotserver'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logParser = logger.getLogParser();
    logParser.attach(child.stderr);
    logParser.once('error', (err) => {
      expect(err.message).toMatch('I could not start up, because no .server file');
      logParser.destroy();
      done();
    });
  });

  she('logs error if address is rejected', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/basics', '-p', '80'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logParser = logger.getLogParser();
    logParser.attach(child.stderr);
    logParser.once('error', (err) => {
      expect(err.message).toMatch('listen EACCES');
      logParser.destroy();
      done();
    });
  });

  she('starts a cluster with -w option', (done) => {
    const child = spawn('node', ['index.js', 'build', 'test/tmpdata/empty'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('exit', () => {
      const child = spawn('node', ['index.js', 'start', 'test/tmpdata/empty', '-w', '2', '-p', '12100'], {
        cwd: path.resolve(__dirname, '../../'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.pipe(process.stdout);
      const logParser = logger.getLogParser();
      logParser.attach(child.stdout);
      logParser.attach(child.stderr);
      logParser.once('ready', () => {
        child.kill('SIGINT');
        logParser.destroy();
        done();
      });
      logParser.once('error', (err) => {
        child.kill('SIGINT');
        logParser.destroy();
        done(err);
      });
    });
  });

  she('shuts down workers', (done) => {
    const child = spawn('node', ['index.js', 'build', 'test/tmpdata/empty'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('exit', () => {
      const child = spawn('node', ['index.js', 'start', 'test/tmpdata/empty', '-w', '2', '-p', '12100'], {
        cwd: path.resolve(__dirname, '../../'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.pipe(process.stdout);
      const logParser = logger.getLogParser();
      logParser.attach(child.stdout);
      logParser.attach(child.stderr);
      logParser.on('ready', () => {
        child.kill('SIGINT');
      });
      logParser.once('shutdown:complete', () => {
        logParser.destroy();
        done();
      });
      logParser.once('error', (err) => {
        child.kill('SIGINT');
        logParser.destroy();
        done(err);
      });
    });
  });

  she('logs worker errors', (done) => {
    const child = spawn('node', ['index.js', 'build', 'test/tmpdata/startuperror'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('exit', () => {
      const child = spawn('node', ['index.js', 'start', 'test/tmpdata/startuperror', '-w', '2'], {
        cwd: path.resolve(__dirname, '../../'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const logParser = logger.getLogParser();
      logParser.attach(child.stdout);
      logParser.attach(child.stderr);      
      logParser.once('error', (err) => {
        expect(err.message).toMatch('BLEEEARGH!');
        child.kill('SIGINT');
      });
      logParser.on('worker:error', () => {
        logParser.destroy();
        done();
      });
    });
  });


  she('// Things Aden already does but are untested...');
  she('provides a build flag to output a production build');
  she('provides a flag to set the focus path');
  she('provides a cleanup flag');
});
