const quoteElement = document.querySelector('#quote');
const quoteButton = document.querySelector('#quoteButton');
const updateQuote = () => fetch('/quotemachine/api/quote')
  .then((res) => res.text())
  .then((text) => (
    quoteElement.innerText = text
  ));
quoteButton.addEventListener('click', () => updateQuote());
updateQuote();
