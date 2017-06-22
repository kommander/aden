const lib = require('./');

before((done) => {
  lib.setup().then(() => done());
});

afterEach(() => {
  global.gc();
  console.log(process.memoryUsage());
});

process.on('uncaughtException', (ex) => {
  console.error('TEST FATAL: Uncaught Exception', ex); // eslint-disable-line
});

process.on('unhandledRejection', (reason) => {
  console.error('TEST FATAL: Unhandled Promise Rejection', reason); // eslint-disable-line
});
