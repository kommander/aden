# Aden

[![Build Status](https://travis-ci.org/kommander/aden.png)](https://travis-ci.org/kommander/aden) [![Coverage Status](https://coveralls.io/repos/github/kommander/aden/badge.svg?branch=master)](https://coveralls.io/github/kommander/aden?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/kommander/aden.svg)](https://greenkeeper.io/)

Aden integrates [Webpack](https://github.com/webpack/webpack),
[Babel](https://babeljs.io) and
[Express](http://expressjs.com/) with an extensible [file](https://en.wikipedia.org/wiki/Computer_file) [tree](https://en.wikipedia.org/wiki/Tree_data_structure) [parser](https://en.wikipedia.org/wiki/Parsing),
to generate frontend asset builds and allow for a classic webserver behaviour
(during development), while setting up a non-mutable express app for production.
You can still do everything you can do with an express app, like route globbing (_/*_), parameters (_/:id_) and middlewares. (Support for Koa is on the [Roadmap](http://aden.zwerk.io/roadmap)).


The actual _/docs_ from this repository are running on a heroku _aden_ instance at [aden.zwerk.io](http://aden.zwerk.io).


> _"It's a website. Can't we just put it on a webserver?"_  
> Anonymous

Sure. Aden provides _zero-config_ application development.

## Prerequisites
[Node 6+](https://nodejs.org/en/) and [NPM 3+](https://www.npmjs.com/).

## Install
```
npm install -g aden
```

## Help
```
$ aden -h

Usage: aden [rootpath][options]

  Options:

    -h, --help           output usage information
    -b, --build          Will only build out the app assets and exit (not start the server)
    -d, --dev            Run in development mode (live reload)
    -n, --new [path]     Bootstrap a new page
    --nd [path]          Bootstrap a new page and start the dev server
    -w, --workers [num]  Start with given [num] of workers, or all CPUs.
    -c, --clean          Remove all dist folders
    -f, --focus [path]   Choose one route to focus on. Mount only that.
    -p, --port [port]    Override the port to mount the server on
    --debug              Debug output
    -s, --silent         Do not output anything on purpose
    -v, --verbose        Output a lot
    --logger-no-date     Omit date from log output
    -V, --version        output the version number
```
Aden runs in _production_ by default, without any CLI options.

## Run
### Development
To confirm aden is installed correctly, try running the docs from the repository,
or check out the getting started guide at [aden.zwerk.io](http:\\aden.zwerk.io)
```
aden -d path/to/docs
```
(Point to any directory containing a `.server` file)

From the repo:
```
node index -d path/to/docs
```

### Production
Running in production requires an existing build,
by default in a _.dist_ folder in the root folder of the app.

To create a build:
```
aden [path] -b
```

Aden assumes a production environment if none is explicitly specified.
To run an existing build:
```
aden [path]
```

# About
_Aden_ is an effort to allow convenient aggregation of data from services,
with a focus on frontend development, packaging and delivery automation.
**Goal**: From idea to production with one server.

---
Copyright 2016/2017 Sebastian Herrlinger

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
