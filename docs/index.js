const quoteElement = document.querySelector('#quote');
const authorElement = document.querySelector('#author');
const originElement = document.querySelector('#origin');
const quoteButton = document.querySelector('#quoteButton');

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-103104194-1', 'auto');
ga('send', 'pageview');

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
