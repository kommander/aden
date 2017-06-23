module.exports = {
  startup: (aden) => {
    aden.log.event('startup:callback', 'blub!');
  },
};
