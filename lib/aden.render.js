'use strict';

const fs = require('fs');
const hogan = require('hogan.js');

const DEV_ENV = process.env.NODE_ENV === 'development';

function getDefaultRender() {
  if (this.defaultRender) {
    return this.defaultRender;
  }

  const defaultRender = function defaultRender(args) {
    const page = args.page;
    const data = args.data;

    if (!page.templateFn) {
      throw new Error(`No template or custom renderer for ${page.path}.`);
    }

    args.html = page.templateFn(data); // eslint-disable-line
    return args;
  };

  this.defaultRender = defaultRender;
  return defaultRender;
}

function getDefaultTemplateEngine() {
  if (this.defaultTemplateEngine) {
    return this.defaultTemplateEngine;
  }

  const defaultTemplateEngine = (filename, templateContent) => {
    const templateFn = hogan.compile(templateContent);
    const template = {
      fn: (data, partials) => templateFn.render(data, partials),
      type: 'mustache',
    };
    return template;
  };

  this.defaultTemplateEngine = defaultTemplateEngine;
  return defaultTemplateEngine;
}

function emptyData(args) {
  // Used in separate data loading pipeline, render template with data
  // >> .data.js, function returning data async, passed on to rendering
  return args;
}

function renderPage(req, res, page, data) {
  this.logger.debug(`Rendering page ${page.route || page.name}`);

  // TODO: always returns 404 if ony a .data.js is given, even though it returns data
  if (req.query.json === 'true') {
    return this.ensureTemplates({ req, res, page, data: data || {} })
      .then(args => page.loadData(args))
      // TODO: rename html to buffer, to send out whatever comes out of the render pipeline
      .then(result => ({
        html: result.data,
      }));
  }

  return Promise.resolve({ req, res, page, data: data || {}, stats: this.webpackStats })
    .then(args => this.ensureTemplates(args))
    .then(args => this.executeHook('pre:render', args))
    .then(args => page.loadData(args))
    .then(args => page.render(args))
    .then(args => this.executeHook('post:render', args));
}

function ensureTemplates(args) {
  const page = args.page;

  if (!page.htmlFileFullPath || (args.page.templateContent && !DEV_ENV)) {
    return Promise.resolve(args);
  }

  // Lazy load and cache templates...
  return new Promise((resolve, reject) => {
    fs.readFile(page.htmlFileFullPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT' && !DEV_ENV) {
          // TODO: running in production there should be a sanity check,
          //       for the build to exist and provide everything needed
          this.logger.error('FATAL: Template file not found. (Did you build the app?)');
          process.exit(1);
        }
        reject(err);
        return;
      }
      page.templateContent = content.toString('utf8');

      const template = page.templateEngine(page.templateFile, page.templateContent);
      page.templateFn = template.fn;
      page.templateType = template.type;

      // ensure the template engine sets the template type on the page,
      // for the json endpoint
      if (!page.templateType) {
        reject(new Error('Template engine must specify the template type'));
      }

      resolve(args);
      return;
    });
  });
}

function sendPage(req, res, page, data) {
  return this.renderPage(req, res, page, data)
    .then(renderResult => {
      if (!renderResult) {
        // This should not happen, catching none-the-less
        this.logger.debug('no render result', page, data);
        throw new Error(`no render result for page ${page.name}`);
      }

      if (!res.headersSent) {
        this.logger.debug('Sending renderPage result', renderResult);
        res.send(renderResult.html || 'ok');
        return;
      }
      this.logger.warn('Headers have already been sent in render pipeline (2)');
    });
}

function loadCustom(filePath, scope) {
  try {
    if (DEV_ENV) {
      require.cache[require.resolve(filePath)] = null;
    }
    // TODO: Setup renderers per page, handing over a page, not aden
    return require(filePath)(scope || this); // eslint-disable-line
  } catch (ex) {
    this.logger.error(`Error loading custom page handler ${filePath}`, ex);
    return null;
  }
}

module.exports = {
  getDefaultRender,
  getDefaultTemplateEngine,
  renderPage,
  loadCustom,
  emptyData,
  sendPage,
  ensureTemplates,
};
