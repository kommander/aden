# Aden CLI, API and Configuration

#### Routes
Aden does not just serve files out of a static file system,
she actually generates a webpack configuration and it builds your frontend assets to be served statically.
Furthermore it allows extending the server with controllers to provide serverside rendering or an API.

To set up a route for, say, a custom xhr api, just

```
mkdir route
echo "module.exports = () => (req, res) => res.send('something');" > ./route/.get.js
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

```js
module.exports = {
  port: 3000,
  route: '*',
  rules: [
    { test: /\.jsx?$/, loader: 'babel-loader', exclude: /node_modules/ },
  ],
  name: 'yourprojectname',
}; > .server
```
