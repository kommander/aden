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
  const registeredChildren = children;
  children = [];

  return Promise.all(registeredChildren
    .map((child) => new Promise((resolve) => {
      if (child.killed || [0, 1].includes(child.exitCode)) {
        resolve();
        return;
      }
      child.on('close', () => setTimeout(() => resolve(), 500))
      if (os.platform() === 'win32') {
        // https://stackoverflow.com/a/28163919
        // Works best so far.
        exec(`taskkill /pid ${child.pid} /T /F`);
      } else {
        child.kill('SIGINT');
        setTimeout(() => child.kill('SIGKILL'), 1000);
      }
    })))
    .then(() => {
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
