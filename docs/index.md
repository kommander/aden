
### Aden

![Aden](favicon.ico)

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
<!-- css and js -->
Aden just set up an express server and configured it to deliver the index.html file located in your root directory.

now you can add `index.html` or `index.js` files to subdirectorys of your root folder, without worrying about setting up routes or delivering payload.

_**Aden will do that for you.**_


```
mkdir sub
cd sub
echo "This is another route aden just created for me"
> index.html
```

`localhost:5000/sub`

#### What exactly did i just do?

`$ aden` runs aden. without a specified path, she uses your working directory as root folder (should contain the .server file).

aden parses all sub-directories for _index_ files, adds them to the webpack entry point, and sets up routes corresponding to the filesystem.

The `-d` flag puts aden in devmode. in devmode aden features hot module reload, watches your filesystem for changes and generates new routes as you change files and directories.


#### TL;DR
`npm i aden -g` => `touch .server` => `aden -d` => use filesystem like a webserver of the days of olde (with all modern webdev goodies).

#### Routes
Aden does not just serve files out of a static file system,
she actually generates a webpack configuration and it builds your frontend assets to be served statically.
Furthermore it allows extending the server with controllers to provide serverside rendering or an API.

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

__Setup__ `-n [root directory]` will set up a ready-to-use base directory.
          `-nd [root directory]` will do the same and additionally start aden in devmode in the setup directory.

###### Supported filetypes

__*webserver with attitude*__

Aden has default attitudes for `.html`, `.js`, `.css`, `md` and `.hbs` files for now.
Her core is conceptionally unopinionated. Our opinions have been defaulted and exported into attitudes.
Attitudes describe how aden handles filetypes. You can write your own attitude if you don't find one that suits your needs.

###### status pages

```
mkdir 404
touch index.html
echo error file not found > index.html
```

aden will assume /404, /403 or /500 routes to contain status pages and render the contents on the corresponding status.


###### Configuration
 aden comes with preconfigurated webpack. However, the `.server` file can export a webpack configuration file to override them.

```
module.exports = {
  port: 3000,
  route: '*',
  rules: [
    { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
  ],
  name: 'yourprojectname',
}; > .server
```
