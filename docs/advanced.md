# <a name="thetop"></a> Aden CLI, API and Configuration

- [The Root](#theroot)
- [Environment](#env)
- [Routing](#routing)
- [Status Pages](#statuspages)
- [The `.server` File](#config)


> Aden conveniently wraps the wall of configuration for webpack and the ever repeating route/controller setup for express, removing a lot of cognitive overhead. _You can still do all the things though_.


## <a name="theroot"></a> The Root
Your _root folder_ is where your application is located, that Aden should handle for you.

<div class="section-menu">
  [<i class="fa fa-arrow-circle-up" aria-hidden="true"></i> Back to the top.](#thetop)
</div>


## <a name="env"></a> Environment
Aden does not care about NODE_ENV. She has two possible runtime _modes_ though, which are _development_ or _production_. If you want to run tests, configure your application with _environment variables_ accordingly and start the development or production server, whichever you want to test.

```
// TODO: Example how to register an environment variable config key
```

<a href="#">TODO: Link to example operations docs generation --ops</a>

<div class="section-menu">
  [<i class="fa fa-arrow-circle-up" aria-hidden="true"></i> Back to the top.](#thetop)
</div>

## <a name="config"></a> The `.server` File
All application specific settings should be _environment variables_, which always overrides the corresponding setting from the `.server` config. Values from the `.server` config can therefor be used to bootstrap a development environment, but will not be used in production mode.

<div class="section-menu">
  [<i class="fa fa-arrow-circle-up" aria-hidden="true"></i> Back to the top.](#thetop)
</div>

## <a name="routing"></a> Routing
Aden does not just serve files out of a static file system,
she actually generates a webpack configuration and it builds your frontend assets to be served statically.
Furthermore it allows extending the server with controllers to provide serverside rendering or an API.

You can still use route _parameters_ like `/user/:id`, on _unix filesystems_, directly in the path if you like. On _windows filesystems_ you can use `/user/+id` to the same effect.

You can also add globbing via the `/user/.server` config like:

```json
{
  "route": "/:id",
}
```

Which will now only match `/user/:id`. If you want to include the _path route_, you can use { "route": ["/", "/:id"] }. In your `/user/.get.js` you can now do whatever you would do in an _express controller_, like:

```
module.exports = () => (req, res) => res.send(req.params.id);
```

<div class="section-menu">
  [<i class="fa fa-arrow-circle-up" aria-hidden="true"></i> Back to the top.](#thetop)
</div>


## <a name="statuspages"></a> Status Pages
Aden currently handles the `404` and `500` response states with _custom  pages_, which behave just like any page. By default, pages with the names _404_ and _500_ in the page graph, will be hooked up as status pages.

```js
// .server options
{
  "statuspages": {
    // a path to match in the page graph
    "500": "statuspages/500",
    "404": "statuspages/404",
    ...
  }
}
```

```
mkdir 404
touch index.html
echo error file not found > index.html
```

<div class="section-menu">
  [<i class="fa fa-arrow-circle-up" aria-hidden="true"></i> Back to the top.](#thetop)
</div>
