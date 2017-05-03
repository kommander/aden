require('highlightjs/styles/monokai-sublime.css');
const button = document.querySelector('#xhr-button');
button.onclick = () => {
  fetch('/api')
    .then((response) => response.json())
    .then((body) => { button.innerText = body.message; });
};
