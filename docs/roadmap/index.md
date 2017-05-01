# Development Roadmap

## Version 0.2
### Extensions
- Activate/Deactivate extensions in config `{ extensions: ['!jsx', '!md', 'html']} > .server`
- autoprefix by default for CSS Extension
- jsx default language extras (es2016/17, polyfills)
- Re-introduce `base.css|scss`

### Dev
- Test coverage for sourcemaps

### config
- Handle dotfiles as special case again (ignored by default)
- Add `KEY_TYPE_CONFIG` behaviour to inherit a `.server` config key for extensions

## Version 0.3
### Extensions
- Add default behaviour `{ default: {}, development: {}, test: {}, production: {} }`
- Proxy Extension. To proxy a path containing a `.proxy` or `.proxy.js` file,
with a function returning a target URL string or a plain string URL target.
- React Extension (providing all the babel boilerplate and loaders)
- Default Linting (Linting as core feature, extendable via hooks to add plugins etc.)

### Server
- Support for [Koa](http://koajs.com/)
- Default SSL setup (take certificates from root folder or `.server`)

### Dev
- optimise watcher and page tree reload (only reload the path that was changed)

### Webpack
- Use aliases from `.server`
- Tree-shaking with webpack 2
- Separate bundles for vendor and common application code (common.js already exists)
- [Optimize incremental builds](http://engineering.invisionapp.com/post/optimizing-webpack/)
- Multi-Process compilation with [happypack](https://github.com/amireh/happypack)
- [Code Splitting](https://github.com/webpack/docs/wiki/code-splitting)

## Version 0.4
- Allow build to be published on github pages (http://import.jekyllrb.com/)
