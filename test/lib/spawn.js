const nativeSpawn = require('child_process').spawn;

const children = [];
const spawn = (...rest) => {
  const child = nativeSpawn(...rest);
  children.push(child);
  return child;
};

const anakin = () => {
  children.forEach((child) => {
    child.kill('SIGINT');
  });
};

process.on('exit', () => {
  anakin();
});

Object.assign(spawn, { anakin });

module.exports = spawn;
