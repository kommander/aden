# Introduction

```
npm i -g aden
```

Hi, I am Aden, an Apache Web-Helicopter.
I can automate a lot of things for you, but lets start at the beginning.
Remember, back in the 90s when my big brother was serving the web?
Those were amazing times. Lets start with what he could do.

Open a Terminal. Create a test folder like `mkdir woa`.
Navigate to that folder like `cd woa`. There, `touch .server`.
Now I can help you out developing with `aden -d`.

As you might have noticed, I am now running on port `5000`,
so just open your browser and navigate to `http://localhost:5000`.

You should get a `404` page, because there's nothing to show yet. Let's create our first content and see what happens.

`echo "<h1>Hello {{name}}</h1>" > index.html`

You Browser should greet you with `Hello {{name}}`. Now, that can be done with any static. Let's see if you like this:

`echo "alert('woa')" > index.js`

Check your browser. I just injected your _script_ into your html. That would look way better with a proper html markup,
but we will get to that in a few minutes.

As you might have guessed by now, I can also inject your _stylesheets_ for you. Try it like this.

`echo "h1 { font-family: sans-serif; }" > index.css`

I don't like serifs. If you do, use the style of your choice.
Your browser should have updated to our stylesheet by now.
But we are still getting that _alert_, so lets remove that again `rm index.js`.

Better. We just created a page, that could be deployed as is. I will take care of optimizing your _bundles_ and _entry points_ for fast delivery, leveraging the hottest web technologies available, like Webpack and Babel.

That one page would be pretty alone though. Lets get started with our first app.

> quote

I like quotes. Let's build a random quote machine!

First, we need a script that gives us a random quote. Create a new folder `mkdir quotemachine`, navigate to it `cd quotemachine` and setup an html entry point with `echo "<h1>QuoteMachine</h1>" > index.html`.

Now add back _javascript_ with `touch quote.js`. Open your favorite editor and fill it with:

```
// For the sake of simplicity of this introduction,
// we will grab a quote from a predefined list.
const quotes = [
  'awesome, meaningful or smart things someone said',
];

module.exports = function getRandomQuote() {
  const index = Math.floor(Math.random() * ((quotes.length - 1) + 1));
  return quotes[index];
};
```

Nothing happens yet. To add this module to our application, we need to require it from our _entry point_. `touch index.js`, open it in your editor and type:

```
const quote = require('./quote');
alert(quote());
```

Ok, that works. Lets render our quote to the page now, instead of alerting the user. Add a `<div id="quote"></div>` to our `index.html` and adjust our _entry point_ script like so:

```
const quote = require('./quote');
const quoteElement = document.getElementById('quote');
quoteElement.innerText = quote();
```

Lets add a button to refresh the quote. After our _quote div_, add `<button id="quoteButton">Get a better quote</button>`. From our _entry point_ script we can now do:

```
const quote = require('./quote');
const quoteElement = document.getElementById('quote');
const quoteButton = document.getElementById('quoteButton');
quoteButton.addEventListener('click', () => (quoteElement.innerText = quote()));
```

Clicking the newly added button on the page should result in the next random quote shown on the page.

Looks a bit 90s though, lets add some styling. I heard _bootstrap_ gives you a good headstart and is widely used. To be able to add modules to our project we need to initialize npm with `npm init --yes`, then we can add bootstrap via `npm i bootstrap`. In our `index.css` we can now just do `@import "~bootstrap/dist/css/bootstrap.min.css"` at the very top.

Add `class="well"` to our _quote div_ and `class="btn"` to our button element.

Check our app. Looks better. Should do for now.

If you want to get your quotes from an API, rather than delivering thousands of them with every request, I can help you out as well.

Lets move our `getRandomQuote` method to the server, by creating a _route_ for our API with `mkdir -p api/quote`. Move our `quote.js` there `mv quote.js api/quote/quote.js`.

In that route we `touch api/quote/.get.js`. If you give me a wrapped method from that file, I will setup a get controller for you. Open `.get.js` and add:

```
const quote = require('./quote');
module.exports = () => (req, res) => res.send(quote());
```

Lets check if our new endpoint works as expected by navigationg to `http://localhost:5000/quotemachine/api/quote`.

So we can request our quote from the server now, rather than delivering all quotes with our frontend application bundle.

Change our `quotemachine/index.js` to the following:

```
const quoteElement = document.getElementById('quote');
const quoteButton = document.getElementById('quoteButton');
quoteButton.addEventListener('click', () =>
  fetch('/quotemachine/api/quote')
    .then((res) => res.text())
    .then((text) => (
      quoteElement.innerText = text
    )))
);
```

All quotes are now produced by our first API endpoint. In our `quotemachine/index.js` we use the _fetch_ API, which is not available in older browser versions. I can help you here as well. I have Babel on board and come with ES6 support out of the box. If you want to target a specific browser range, have a look at the _babel-preset-env_, which I have on-board by default. To learn more about babel and how to control it with a `.babelrc` file, have a look _here_.

**TL;DR**
```
npm i -g aden
mkdir woa
cd woa
touch .server
aden -d
# Open your browser at http://localhost:5000
echo "<h1>Hello {{name}}</h1>" > index.html
```


---
Lets add a _Todo List_ for our new project. Create a new folder `mkdir todo`, navigate to it `cd todo` and let's setup a new _entry point_ by creating a file like `echo "# Todos" > index.md`.
Navigate to `http://localhost:5000/todos`, you should see and _html formatted_ page.

Yes, I am versatile. I can serve a whole lot for you, depending on my attitude, like _Markdown_ files, that are put through _marked_ and served like static files then.
