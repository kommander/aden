## Installation
install aden via

`npm i aden -g`

## Getting started

- make an example folder
- navigate to it
- type:
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

### What exactly did i just do?

The `.server` file designates it's folder to be the root of the server filesystem. it can contain configuration options or middlewares. aden parses all subdirecorys contained by the root for index files and sets up routes corresponding to the filesystem.

`$ aden` runs aden. without a specified path, she uses your working directory as root folder (should contain the .server file).

The `-d` flag puts aden in devmode. in devmode aden features hot module reload, watches your filesystem for changes and generates new routes as you change files and directorys.


### TL;DR
`npm i aden -g` => `touch .server` => `aden -d` => use filesystem like a webserver of the days of olde.


### Features

_**Aden conveniently wraps the wall of configuration for webpack and the ever repeating route/controller setup for express, removing a lot of cognitive overhead.**_

##### Devmode `-d`
Watches filesystem for changes and sets up routes life for faster iteration. implements webpacks hot module reload.
##### Build `-b`
Builds your frontend for production via webpack (including babel transpiling, minification and uglification) and the corresponding backend for node.js and express.

##### Supported filetypes
Aden can handle `.html`, `.js`, `.css`, and `.hbs` files for now. support is modular an can be turned off for less overhead.