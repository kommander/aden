const aden = require('../../lib/aden');
const logParser = require('../../lib/aden.logger').getLogParser();
const spawn = require('child_process').spawn;
const path = require('path');

describe('CLI', () => {
  she('has a dev mode cli command', (done) => {
    const child = spawn('node', ['index.js', 'dev', 'test/tmpdata/basics'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    logParser.attach(child.stdout);
    logParser.on('listening', () => child.kill());
    child.on('error', done);
    child.on('exit', () => {
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
        logParser.attach(child.stdout);
        logParser.on('listening', () => child.kill());
        child.on('error', done);
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
    logParser.attach(child.stdout);
    child.on('error', done);
    child.on('exit', () => {
      done();
    });
  });

  she('// Things Aden already does but are untested...');
  she('provides a build flag to output a production build');
  she('provides a flag to set the focus path');
  she('provides a cleanup flag');
});
