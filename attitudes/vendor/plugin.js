const webpack = require('webpack');
const path = require('path');
const _ = require('lodash');

function VendorPlugin(options) {
  this.dist = options.dist;
}

VendorPlugin.prototype.apply = function apply(compiler) {
  const userRequests = [];
  let secondPass = false;

  compiler.plugin('compilation', (compilation) => {
    compilation.plugin('normal-module-loader', (loaderContext, mod) => {
      if (!secondPass) {
        if (mod.reasons.length > 0) {
          userRequests.push(mod.userRequest);
        }
      } else {
        // console.log(mod);
      }
    });
    compilation.plugin('need-additional-pass', () => {
      if (!secondPass) {
        secondPass = true;
        return true;
      }
      return undefined;
    });
  });

  compiler.plugin('additional-pass', (done) => {
    if (secondPass) {
      const uniqueRequests = _.uniq(userRequests).filter((req) => req.match(/node_modules/));
      const manifestPath = path.join(this.dist, 'vendor-manifest.json');
      const dllPlugin = new webpack.DllPlugin({
        path: manifestPath,
        name: '[name]',
      });

      const vendorConfig = {
        resolve: {
          extensions: ['.js', '.jsx'],
        },
        entry: {
          vendor: uniqueRequests,
        },
        output: {
          path: path.join(this.dist, 'public'),
          filename: '[name].js',
          library: '[name]',
        },
        plugins: [
          dllPlugin,
        ],
      };

      const vendorCompiler = webpack(vendorConfig);
      vendorCompiler.run((error) => {
        if (error) {
          return done(error);
        }
        const dllReferencePlugin = new webpack.DllReferencePlugin({
          context: '.',
          manifest: require(manifestPath),
        });
        compiler.apply(dllReferencePlugin);
        return done(null);
      });
    }
  });
};

module.exports = VendorPlugin;
