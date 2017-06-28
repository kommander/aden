# Vendor Attitude

The `vendor` Attitude integrates the webpack [DllPlugin](https://webpack.js.org/plugins/dll-plugin/) 
with the [DllReferencePlugin](https://webpack.js.org/plugins/dll-plugin/#dllreferenceplugin) 
to allow the extraction of vendor libraries.

In your `.server` file you can name the `modules` that should be treated as vendor libraries:
```json
{
	"vendor": ["moduleA", "moduleB"]
}
```

If you need multiple named vendor library bundles:
```json
{
	"vendors": {
		a: ["moduleA"],
		b: ["moduleB"]
	}
}
```

[Goto file in Repository](https://github.com/kommander/aden/tree/master/attitudes/vendor)
