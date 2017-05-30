const fs = require('fs');
const path = require('path');
const hogan = require('hogan.js');
const cannot = require('brokens');

/**
 * hbs
 * Gathers
 */
module.exports = (aden) => {
  const {
    ENTRY_DYNAMIC,
  } = aden.constants;

  aden.registerKey('hbs', {
    type: 'object',
    config: true,
    value: {
      entry: 'index',
      layout: true,
    },
    inherit: true,
  });

  aden.registerKey('hbsIndex', {
    type: 'rpath',
    entry: ENTRY_DYNAMIC,
  });

  aden.registerKey('templates', {
    type: 'custom',
    value: {},
  });

  aden.registerFiles('hbsFiles', /\.(hbs|hdbs)$/, {
    handler: ({ page, fileInfo }) => {
      if (fileInfo.name === page.hbs.value.entry) {
        page.set('hbsIndex', fileInfo.rpath);
        return;
      }
    },
    entry: ENTRY_DYNAMIC,
    distExt: '.hbs',
  });

  aden.hook('setup:route', ({ page }) =>
    Promise.resolve().then(() => {
      const templates = page.hbsFiles.value.reduce((prev, file) => {
        try {
          const content = fs.readFileSync(file.dist, 'utf8');
          const template = hogan.compile(content);
          return Object.assign(prev, {
            [file.name]: {
              render: (data, partials) => template.render(data, partials),
            },
          });
        } catch (ex) {
          throw cannot('compile', 'hbs template')
            .because(ex)
            .addInfo(file.dist);
        }
      }, {});
      page.set('templates', templates);
    })
  );

  aden.hook('setup:route', ({ page }) => {
    if (page.hbsIndex.value) {
      Object.assign(page, {
        get: (req, res, thepage, data) => {
          page.hbsIndex
            .load((content) => hogan.compile(content.toString('utf8')))
            .then((template) => {
              const html = template.render({ req, res, page: thepage, data });
              res.send(html);
            });
        },
      });
    }
    return null;
  });

  aden.hook('post:apply', ({ webpackConfigs, pages }) => {
    const frontendConfig = webpackConfigs
      .find((conf) => (conf.name === 'frontend'));

    frontendConfig.resolve.extensions.push(
      '.hbs', '.hdbs', '.handlebars'
    );

    frontendConfig.module.rules.push({
      test: /\.(hbs|hdbs|handlebars)$/,
      include: [
        path.resolve(aden.rootPath, '../node_modules'),
        path.resolve(aden.rootPath, '../../node_modules'),
      ].concat(aden.flattenPages(pages).map((page) => page.path.resolved)),
      use: [
        {
          loader: require.resolve('html-loader'),
        },
      ],
    });
  });
};
