'use strict';

const fs = require('fs');
const hogan = require('hogan.js');

const DEV_ENV = process.env.NODE_ENV === 'development';

function getDefaultRender() {
  if (this.defaultRender) {
    return this.defaultRender;
  }

  const defaultRender = (args) => {
    const page = args.page;
    const data = args.data;
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

  return Promise.resolve({ req, res, page, data: data || {} })
    .then(args => this.ensureTemplates(args))
    .then(args => this.executeHook('pre:render', args))
    .then(args => page.loadData(args))
    .then(args => page.render(args))
    .then(args => this.executeHook('post:render', args))
    .catch(err => {
      this.logger.warn('Error rendering page', { err, stack: err.stack }, err);
      return this.sendPage(req, res, this.errorPage, { err });
    });
}

function ensureTemplates(args) {
  if (args.page.templateContent && !DEV_ENV) {
    return Promise.resolve(args);
  }

  const page = args.page;

  // Lazy load and cache templates...
  return new Promise((resolve, reject) => {
    if (!page.htmlFileFullPath) {
      this.logger.warn(`FATAL: No html file path for ${page.name}`, page, page.htmlFileFullPath);
      process.exit(1);
    }
    fs.readFile(page.htmlFileFullPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT' && !DEV_ENV) {
          this.logger.warn('FATAL: Template file not found. (Did you build the app?)');
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
  if (req.query.json === 'true') {
    return this.ensureTemplates({ req, res, page, data: data || {} })
      .then(args => page.loadData(args))
      .then(result => {
        if (!res.headersSent) {
          res.send({
            templateType: page.templateType,
            template: page.templateContent,
            data: result.data,
          });
          return;
        }
        this.logger.warn('FATAL: Headers have already been sent in render pipeline');
      });
  }

  return this.renderPage(req, res, page, data)
    .then(renderResult => {
      if (!res.headersSent) {
        res.send(renderResult.html || 'ok');
        return;
      }
      this.logger.warn('FATAL: Headers have already been sent in render pipeline');
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
    this.logger.warn(`Error loading custom page handler ${filePath}`, ex);
    throw ex;
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
