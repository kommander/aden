module.exports = {
  md: {
    marked: {
      highlight: (code, lang) => {
        if (!lang) {
          return code;
        }
        return require('highlightjs').highlight(lang, code).value;
      },
    },
  },
};
