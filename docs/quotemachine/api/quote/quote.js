const quotes = [
  'awesome, meaningful or smart things someone said',
  'more grateful things a vip said',
];

module.exports = function getRandomQuote() {
  const index = Math.floor(Math.random() * ((quotes.length - 1) + 1));
  return quotes[index];
};
