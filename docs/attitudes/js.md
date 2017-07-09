# JS Attitude

The `js` Attitude integrates the webpack [babel-loader](https://github.com/babel/babel-loader). Aden comes bundled with several babel presets and plugins:

 - [babel-preset-es2015](https://babeljs.io/docs/plugins/preset-es2015/) (on by default)
 - [babel-preset-env](https://github.com/babel/babel-preset-env)
 - [babel-plugin-transform-object-rest-spread](https://babeljs.io/docs/plugins/transform-object-rest-spread/)

You can use the bundled presets/plugins from your `.babelrc` as if they were locally installed.
```json
{
	"presets": [
		"es2015", 
		["env", {
      "targets": {
        "browsers": ["last 2 versions", "safari >= 7"]
      }
    }]
	]
}
```

### Use Additional Presets/Plugins
At any time, you can install and use additional presets/plugins for your project with `npm`.


[Goto file in Repository](https://github.com/kommander/aden/tree/master/attitudes/js.js)
