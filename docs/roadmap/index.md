# Development Roadmap

## Extensions
- Activate/Deactivate extensions in config `{ extensions: ['!jsx', '!md', 'html']} > .server`

## config
- Handle dotfiles as special case again (ignored by default)
- Add default behaviour `{ default: {}, development: {}, test: {}, production: {} }`
- Add `KEY_TYPE_CONFIG` behaviour to inherit a `.server` config key for extensions

## Cluster
- Provide default clustering setup via CLI `-w [num_of_workers_or_all_cpus]`

## Tooling
- Enable [Greenkeeper](https://greenkeeper.io/)
