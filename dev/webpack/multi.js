// MultiCompiler Hot reload
// Works with the following versions:
// ├─┬ webpack@2.6.0
// │ ├─┬ webpack-sources@0.2.3
// ├── webpack-dev-middleware@1.10.2
// ├─┬ webpack-hot-middleware@2.18.0

const webpack = require('webpack');
const path = require('path');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');
const express = require('express');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const rimraf = require('rimraf');
const distDir = path.resolve(__dirname, '.dist');
const context = __dirname;
rimraf.sync(distDir);

const app = express();

const config1 = {
  name: 'config1',
  entry: [
    path.resolve(__dirname, 'test.js'),
    // `${require.resolve('webpack-hot-middleware/client')}?reload=true&path=__ADEN__HMR`,
  ],
  context,
  output: {
    path: distDir,
    filename: 'bundle1.js',
    publicPath: '/',
    hotUpdateChunkFilename: '[hash].chunk.hot-update.js',
    hotUpdateMainFilename: '[hash].hot-update.json',
  },
  plugins: [

  ],
};

const config3 = {
  name: 'config3',
  entry: [
    path.resolve(__dirname, 'test.js'),
    // `${require.resolve('webpack-hot-middleware/client')}?reload=true&path=__ADEN__HMR`,
  ],
  context,
  output: {
    path: distDir,
    filename: 'bundle1.js',
    publicPath: '/',
    hotUpdateChunkFilename: '[hash].chunk.hot-update.js',
    hotUpdateMainFilename: '[hash].hot-update.json',
  },
};

const config2 = {
  name: 'config2',
  entry: [
    path.resolve(__dirname, 'test.js'),
    `${require.resolve('webpack-hot-middleware/client')}?reload=true&name=config2&path=/__ADEN__HMR&__webpack_public_path=http://localhost:5000`,
  ],
  context,
  output: {
    path: distDir,
    filename: 'bundle2.js',
    publicPath: '/',
    hotUpdateChunkFilename: '[hash].chunk.hot-update.js',
    hotUpdateMainFilename: '[hash].hot-update.json',
  },
  // hot: true,
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
    }),
  ],
  devServer: {
    hot: true,
  },
};

const compiler = webpack([config1, config2, config3]);

app.use(webpackDevMiddleware(compiler, {
  hot: true,
  filename: 'bundle.js',
  publicPath: '/',
  stats: {
    colors: true,
  },
  historyApiFallback: true,
}));
app.use(webpackHotMiddleware(compiler, {
  path: '/__ADEN__HMR',
  log: console.log,
}));
app.use(express.static(distDir));

app.listen(5000);
