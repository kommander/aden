# Aden
Backend For Frontend

> _"It's a website. Can't we just put it on a webserver?"_  
> Anonymous

Sure.

# WIP
This project is work in progress. Feedback very welcome.

## Install
```
npm install -g aden
```

## Help
```
aden --help
```

## Run
### Development
```
aden -d docs
```
(Point to any directory containing a `.aden` file)

From the repo:
```
node index -d docs
```

### Production
Running in production requires an existing build,
by default in a _.dist_ folder in the root folder of the app.

To run a build:
```
aden docs -b
```

Aden assumes a production environment if none is explicitly specified.
```
aden docs
```

# About
_Aden_ is an effort to allow convenient aggregation of data from services,
with a focus on frontend development, packaging and delivery automation.

It integrates [webpack](https://github.com/webpack/webpack),
[Babel](https://babeljs.io) and
[express](http://expressjs.com/) with an extensible [file](https://en.wikipedia.org/wiki/Computer_file) [tree](https://en.wikipedia.org/wiki/Tree_(data_structure)) [parser](https://en.wikipedia.org/wiki/Parsing),
to generate frontend asset builds and allow for a classic webserver like behaviour
(during development), while setting up a non-mutable express app for production.


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
