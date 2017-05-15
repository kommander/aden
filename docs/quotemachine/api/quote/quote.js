const quotes = [
  'Simplicity is prerequisite for reliability.',
  'There are more useful systems developed in languages deemed awful \
    than in languages praised for being beautiful--many more',
];

module.exports = function getRandomQuote() {
  const index = Math.floor(Math.random() * ((quotes.length - 1) + 1));
  return quotes[index];
};
