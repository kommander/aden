const path = require('path');
console.log(__dirname);

module.exports = {
	context: __dirname,
	entry: 'index.js',
	resolve: {
		extensions: ['.js', '.scss'],
		modules: [
			path.join(__dirname, 'local-modules'),
		],
	},
	output: {
		path: path.join(__dirname, '.dist'),
		filename: 'bundle.js',
	}
};