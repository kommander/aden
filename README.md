# :seedling: Aden
> CLI for the Web.

_Aden_ is an effort to reduce application boilerplate that becomes technical debt.

Aden allows integration of application behaviour with an extensible [file](https://en.wikipedia.org/wiki/Computer_file) [tree](https://en.wikipedia.org/wiki/Tree_data_structure) [parser](https://en.wikipedia.org/wiki/Parsing). Aden also allows for straight forward server side rendering and API development.

The _/docs_ from this repository are running on _aden_ on a heroku instance at [aden.zwerk.io](https://aden.zwerk.io).


[![Build Status](https://travis-ci.org/kommander/aden.png)](https://travis-ci.org/kommander/aden)
[![Build status](https://ci.appveyor.com/api/projects/status/chkkhb0sgcpmgfyl?svg=true)](https://ci.appveyor.com/project/kommander/aden)
[![Coverage Status](https://coveralls.io/repos/github/kommander/aden/badge.svg?branch=master)](https://coveralls.io/github/kommander/aden?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/kommander/aden.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/kommander/aden/badge.svg)](https://snyk.io/test/github/kommander/aden)

Supporting OSX, Linux and Windows.

## Install
Prerequisites: [Node](https://nodejs.org/en/) and [NPM](https://www.npmjs.com/)
```
npm install -g aden
```

## Help
```
$ aden -h
```
Aden runs in _production_ by default, without any specific CLI options.

## Run
### Development
To confirm aden is installed correctly, try running the docs from the repository,
or check out the getting started guide at [aden.zwerk.io](https://aden.zwerk.io)
```
aden dev path/to/docs
```
(Point to any directory containing a `.server` file)

From the repo:
```
node index dev docs
```

### Production
Running in production requires an existing build,
by default in a _.dist_ folder in the root folder of the app.

To create a build:
```
aden build [path]
```

To run an existing production build:
```
aden start [path]
```

# Resources
 - [12 Factor Application](https://12factor.net/)

---
Copyright 2016-2018 Sebastian Herrlinger

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
