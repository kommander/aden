/**
 * md
 */
module.exports = (aden) => {
  const {
    ENTRY_STATIC,
  } = aden.constants;

  aden.registerKey('md', {
    type: 'object',
    config: true,
    value: {
      entry: 'index',
      marked: null, // TODO: merge with `md` key options to save one level of config depth
      layout: true,
    },
    inherit: true,
  });

  aden.registerFiles('mdFiles', /\.(md|markdown)$/, {
    entry: ENTRY_STATIC,
    distExt: '.html',
  });

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push('.md', '.markdown');
    const markdownLoader = {
      loader: require.resolve('markdown-loader'),
    };

    const markedOpts = pages[0].md.value.marked;
    if (markedOpts && Object.keys(markedOpts).length > 0) {
      Object.assign(markdownLoader, {
        options: markedOpts,
      });
    }

    frontendConfig.module.rules.push({
      test: /\.(md|markdown)$/,
      use: [
        {
          loader: require.resolve('html-loader'),
          // options: {
          //   minimize: aden.isDEV,
          // },
        },
        markdownLoader,
      ],
    });
  });
};
