const quoteElement = document.querySelector('#quote');
const authorElement = document.querySelector('#author');
const originElement = document.querySelector('#origin');
const quoteButton = document.querySelector('#quoteButton');

const updateQuote = () => fetch('/quotemachine/api/quote')
  .then((res) => res.json())
  .then((json) => {
    quoteElement.innerText = json.text;
    authorElement.innerText = json.author;
    originElement.innerText = json.origin;
    originElement.href = json.origin;
  });

quoteButton.addEventListener('click', () => updateQuote());

updateQuote();
