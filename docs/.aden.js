module.exports = {
  md: {
    marked: {
      highlight: (code) => {
        return require('highlightjs').highlightAuto(code).value;
      },
    },
  },
};
