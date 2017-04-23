const lib = require('./');

before((done) => {
  lib.setup().then(() => done());
});

process.on('uncaughtException', (ex) => {
  console.error('FATAL: Uncaught Exception', ex); // eslint-disable-line
});

process.on('unhandledRejection', (reason) => {
  console.error('FATAL: Unhandled Promise Rejection', reason); // eslint-disable-line
});
