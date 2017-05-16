const quoteElement = document.querySelector('#quote');
const authorElement = document.querySelector('#author');
const originElement = document.querySelector('#origin');
const quoteButton = document.querySelector('#quoteButton');

const updateQuote = () => Promise.resolve()
  .then(() => quoteButton.removeEventListener('click', updateQuote))
  .then(() => fetch('/quotemachine/api/quote'))
  .then((res) => res.json())
  .then((json) => {
    if (originElement.href === json.origin) {
      updateQuote();
      return;
    }
    quoteElement.innerText = json.text;
    authorElement.innerText = json.author;
    originElement.innerText = json.origin;
    originElement.href = json.origin;
  })
  .then(() => quoteButton.addEventListener('click', updateQuote));

quoteButton.addEventListener('click', updateQuote);

updateQuote();
