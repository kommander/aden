# HTML Attitude
Registers an `index.html` as _static entry point_. Images and links will be processed by webpack.
All assets will be _injected_ as configured.

## Aden and HTML
Aden identifies as a webserver and as HTML is a core part of the web, her core integrates the [html-weback-plugin](https://github.com/jantimon/html-webpack-plugin) to generate entry points from any file. An entry point can be _static_ or _dynamic_. Static entry points are output to the `.dist/public` directory. Dynamic entry points will be put into `.dist` (maybe `.dist/dynamic` with page paths?).
To handle dynamic entry points, like templates that should be rendered on request,
each _FILE_ or _PATH_ type _page key_ has an async/thenable `key.load()` method. This allows Aden to take care of caching for you. In development mode, she will hot load all files and resources, in production she will take care of caching the file contents for you, unless you say otherwise.

If you don't want any assets to be injected into your entry points, you can set `{ inject: false }` in `.server`.
