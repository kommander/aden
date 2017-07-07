const os = require('os');
const childProcess = require('child_process');
const nativeSpawn = childProcess.spawn;
const exec = childProcess.exec;

let children = [];
const spawn = (...rest) => {
  const child = nativeSpawn(...rest);
  children.push(child);
  return child;
};

const anakin = (done) => {
  return Promise.all(children
    .map((child) => new Promise((resolve) => {
      if (child.killed || [0, 1].includes(child.exitCode)) {
        resolve();
        return;
      }
      if (os.platform() === 'win32') {
        child.on('exit', () => setTimeout(() => resolve(), 500))
        exec('taskkill /pid ' + child.pid + ' /T /F');
      } else {
        child.kill('SIGINT');
        resolve();
      }
    })))
    .then(() => {
      children = [];
      if(typeof done === 'function') {
        done();
      }
    });
};

process.on('error', () => {
  anakin();
});

process.on('exit', () => {
  anakin();
});

Object.assign(spawn, { anakin });

module.exports = spawn;
