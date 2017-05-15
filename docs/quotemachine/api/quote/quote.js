const quotes = [
  {
    text: 'Simplicity is prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
    origin: 'https://en.wikiquote.org/wiki/Edsger_W._Dijkstra',
  },
  {
    text: 'There are more useful systems developed in languages deemed awful \
      than in languages praised for being beautiful--many more',
    author: 'Bjarne Stroustroup',
    origin: 'http://www.stroustrup.com/bs_faq.html#really-say-that',
  },
  {
    text: 'Internet explorer does not spark joy. Maybe we should stop using it.',
    author: 'Douglas Crockford',
    origin: 'https://www.youtube.com/watch?v=NPB34lDZj3E',
  },
];

module.exports = function getRandomQuote() {
  const index = Math.floor(Math.random() * ((quotes.length - 1) + 1));
  return quotes[index];
};
