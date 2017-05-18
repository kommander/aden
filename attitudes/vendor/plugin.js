const webpack = require('webpack');
const path = require('path');
const _ = require('lodash');

function VendorPlugin(options = {}) {
  this.dist = options.dist;
  this.built = false;
  this.context = options.context || '.';
  this.publicPath = options.publicPath || '';
}

VendorPlugin.prototype.apply = function apply(compiler) {
  const userRequests = [];
  let secondPass = false;

  compiler.plugin('compilation', (compilation) => {
    compilation.plugin('normal-module-loader', (loaderContext, mod) => {
      if (!this.built) {
        if (!secondPass) {
          if (mod.reasons.length > 0) {
            // console.log(mod);
            userRequests.push(mod.resource);
          }
        }
      }
    });
    compilation.plugin('need-additional-pass', () => {
      if (!secondPass && !this.built) {
        secondPass = true;
        return true;
      }
      return;
    });
  });

  compiler.plugin('additional-pass', (done) => {
    if (!this.built && secondPass) {
      const uniqueRequests = _.uniq(userRequests)
        .filter((req) => req.match(/node_modules/))
        .filter((req) => !req.match(/node_modules\/(webpack|querystring|ansi-html|html-entities|css-loader|ieee754|isarray|base64|ansi-regex|buffer|strip-ansi)/));
      console.log(require('util').inspect(uniqueRequests));
      const manifestPath = path.join(this.dist, 'vendor-manifest.json');
      const dllPlugin = new webpack.DllPlugin({
        context: this.context,
        name: '[name]',
        path: manifestPath,
      });

      const vendorConfig = {
        target: 'web',
        resolve: {
          extensions: ['.js', '.jsx'],
        },
        entry: {
          vendor: uniqueRequests,
        },
        context: this.context,
        output: {
          path: path.join(this.dist, 'public'),
          filename: '[name].js',
          library: '[name]',
          libraryTarget: 'commonjs',
          publicPath: this.publicPath,
        },
        plugins: [
          dllPlugin,
        ],
        module: {
          noParse: [
            /\.git/, /\.dist/,
          ],
          rules: [],
        },
        devtool: this.isDEV ? 'source-map' : false,
      };

      const vendorCompiler = webpack(vendorConfig);
      vendorCompiler.run((error) => {
        if (error) {
          return done(error);
        }
        const dllReferencePlugin = new webpack.DllReferencePlugin({
          context: this.context,
          manifest: require(manifestPath),
          sourceType: 'commonjs',
          // scope: 'vendor',
        });

        this.built = true;

        compiler.apply(dllReferencePlugin);
        // const namedModulesPlugin = new webpack.NamedModulesPlugin();
        // compiler.apply(namedModulesPlugin);
        return done(null);
      });
    }
  });
};

module.exports = VendorPlugin;
