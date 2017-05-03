module.exports = {
  startup: () => {
    return Promise.resolve().then(() => console.log('server startup'));
  }
};
