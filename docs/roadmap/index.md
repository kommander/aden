# Development Roadmap

## Version 0.2
### Extensions
- Activate/Deactivate extensions in config `{ extensions: ['!jsx', '!md', 'html']} > .server`
- autoprefix by default for CSS Extension
- jsx default language extras

### Dev
- Test coverage for sourcemaps

### config
- Handle dotfiles as special case again (ignored by default)
- Add `KEY_TYPE_CONFIG` behaviour to inherit a `.server` config key for extensions

## Version 0.3
### Cluster
- Provide default clustering setup via CLI `-w [num_of_workers_or_all_cpus]`

### Extensions
- Add default behaviour `{ default: {}, development: {}, test: {}, production: {} }`

### Server
- Support for [Koa](http://koajs.com/)
