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
      return undefined;
    });
  });

  compiler.plugin('additional-pass', (done) => {
    if (!this.built && secondPass) {
      // TODO: switch to make vendor includes explicit
      //       -> still parse and filter, show suggestions for vendor in development
      const uniqueRequests = _.uniq(userRequests)
        // TODO: Make includes setable
        .filter((req) => req.match(/node_modules/))
        // TODO: make excludes setable
        .filter((req) => !req.match(/node_modules\/(webpack|querystring|ansi-html|html-entities|css-loader|ieee754|isarray|base64|ansi-regex|buffer|strip-ansi)/));

      if (uniqueRequests.length === 0) {
        this.built = true;
        done(null);
        return;
      }

      const manifestPath = path.join(this.dist, 'vendor-manifest.json');
      const dllPlugin = new webpack.DllPlugin({
        context: this.context,
        name: '[name]',
        path: manifestPath,
      });

      // TODO: use callback to do actual vendor compilation outside
      //       -> but add dll reference plugin within here again
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
