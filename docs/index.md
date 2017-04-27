
### Aden
_**Rapid Prototyping for your Project**_

#### Installation
install aden via

`npm i aden -g`

#### Getting started

make an example folder
navigate to it
type:

```
touch .server
echo "Hello World" > index.html
aden -d
```

Open your web browser at `localhost:5000` => Hello World!

Aden just set up an express server and configured it to deliver the index.html file located in your root directory. now you can add `index.html` oder `index.js` files to subdirectorys of your root folder, without worrying about setting up routes or delivering payload.

_**Aden will do that for you.**_

```
mkdir sub
cd sub
echo "This is another route aden just created for me"  > index.html
```

`localhost:5000/sub`

#### What exactly did i just do?

The `.server` file designates it's folder to be the root of the server filesystem. it can contain configuration options or middlewares. aden parses all subdirecorys contained by the root for index files and sets up routes corresponding to the filesystem.

`$ aden` runs aden. without a specified path, she uses your working directory as root folder (should contain the .server file).

The `-d` flag puts aden in devmode. in devmode aden features hot module reload, watches your filesystem for changes and generates new routes as you change files and directorys.


#### TL;DR
`npm i aden -g` => `touch .server` => `aden -d` => use filesystem like a webserver of the days of olde.

#### Routes
Aden can do more than just serve files out of a static file system.
To set up a route for, say, a custom xhr api, just

```
mkdir route
touch .get.js
echo controller > .get.js
```

Aden set up a get route at root/route. check out this example:
<div id="content-wrapper">
  <button id="xhr-button">XHR Example</button>
</div>

#### Features

_**Aden conveniently wraps the wall of configuration for webpack and the ever repeating route/controller setup for express, removing a lot of cognitive overhead.**_

__Devmode__ `-d` Watches filesystem for changes and sets up routes live for faster iteration, using webpacks hot module reload.

__Build__ `-b` Builds your application for production via webpack  (including babel transpiling, minification and uglification) and the corresponding backend for node.js and express.

###### Supported filetypes
Aden has default extensions for `.html`, `.js`, `.css`, `md` and `.hbs` files for now. Support is modular an can be toggled on/off.

###### .server file
the .server file indicates the root folder for aden, but it also can return a configuration object.
