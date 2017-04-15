const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = (aden) => {
  aden.registerKey({
    name: 'css',
    type: 'string',
    default: 'index',
  });

  aden.registerKey({
    name: 'cssFile',
    type: 'rpath',
    inherit: false,
  });

  // TODO: use page.getKey(name) and page.setKey(name, value)
  aden.registerFile(/\.css$/, ({ page, fileInfo }) => {
    if (fileInfo.name === page.css) {
      return Object.assign(page, {
        cssFile: fileInfo.rpath,
      });
    }

    return page;
  });

  aden.hook('apply', ({ page, webpackEntry, webpackConfig }) => {
    if (page.cssFile) {
      webpackEntry.push(page.resolved.cssFile);

      const extractPlugin = new ExtractTextPlugin('[name]-[hash].css', { allChunks: true });
      webpackConfig.plugins.push(extractPlugin);

      webpackConfig.module.loaders.push({
        test: /\.css$/,
        include: [page.resolved.path],
        loader: ExtractTextPlugin.extract('style-loader', 'css-loader'),
        // loaders: ['style-loader', 'css-loader'],
      });
    }
  });

  return {
    key: 'css',
    version: '0.1.0',
  };
};
