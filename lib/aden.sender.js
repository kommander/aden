'use strict';

const fs = require('fs');
const hogan = require('hogan.js');
const _ = require('lodash');
const cannot = require('cannot');

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
  // Used in separate data loading pipeline, send template with data
  // >> .data.js, function returning data async, passed on to sending
  return args;
}

function sendPage(req, res, page, data) {
  this.logger.debug('Sending page', {
    page: _.pick(page, [
      'name',
      'route',
      'send',
    ]),
  });

  // TODO: always returns 404 if ony a .data.js is given, even though it returns data
  // TODO: switch with req accept header not query param
  if (req.query.json === 'true') {
    return this.ensureTemplates({ req, res, page, data: data || {} })
      .then(args => page.loadData(args))
      // TODO: rename html to buffer, to send out whatever comes out of the send pipeline
      .then(result => ({
        html: result.data,
      }));
  }

  return Promise.resolve({ req, res, page, data: data || {}, stats: this.webpackStats })
  .then(args => this.ensureTemplates(args))
  .then(args => this.applyHook('pre:send', args))
  .then(args => page.loadData(args))
  .then(() => page.send(req, res, page, data))
  .then(sendResult => this.applyHook('post:send', sendResult));
}

// TODO: This is what can be replaced by .send.js
// TODO: Provide templates on plugin level(?)
function defaultSend(req, res, page, data) {
  if (!page.templateFn) {
    throw cannot('send', 'page').because('there is no template function');
  }

  page.logger.debug('Default Sender', {
    data,
    templateFn: page.templateFn.toString(),
  });

  return Promise.resolve()
    .then(() => page.templateFn(data))
    .then((sendResult) => {
      if (!sendResult) {
        // TODO: let cannot parse subject/verb from camelcase/underscore/xnotation,
        // in most cases probably the function name, optionally.
        throw cannot('send', 'page').because('the template function result was empty');
      }

      if (!res.headersSent) {
        this.logger.debug('Sending result', { sendResult });
        res.send(sendResult || 'ok');
        return sendResult;
      }

      this.logger.warn('Headers have already been sent in send pipeline (2)');
      return sendResult;
    });
}

function ensureTemplates(args) {
  const page = args.page;

  this.logger.debug('ensureTemplates', {
    page: _.pick(page, ['name', 'path', 'resolved']),
  });

  if (!page.htmlFileFullPath || args.page.templateContent && !this.isDEV) {
    return Promise.resolve(args);
  }

  // Lazy load and cache templates...
  return new Promise((resolve, reject) => {
    fs.readFile(page.htmlFileFullPath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT' && !this.isDEV) {
          // TODO: running in production there should be a sanity check,
          //       for the build to exist and provide everything needed
          this.logger.error('FATAL: Template file not found. (Did you build the app?)');
          process.exit(1);
        }
        reject(err);
        return;
      }
      page.templateContent = content.toString('utf8');

      this.logger.debug(`Creating template function with ${page.templateFile}`, _.pick(page, [
        'templateFile',
        'templateContent',
      ]));

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

// TODO: Sandbox userland server components
// TODO: reduce config to data: '.data', parse file ext (js|php|...)
//       -> php extension loader
//       -> start a php worker and run php files (plugin hooking up .php)
//       -> default extension loader for js,
//       -> unknown extension -> error
function loadCustom(filePath, scope) {
  try {
    if (this.isDEV) {
      require.cache[require.resolve(filePath)] = null;
    }
    return require(filePath)(scope || this); // eslint-disable-line
  } catch (ex) {
    this.logger.error(`Error loading custom page handler ${filePath}`, ex);
    return null;
  }
}

module.exports = {
  getDefaultTemplateEngine,
  loadCustom,
  emptyData,
  sendPage,
  ensureTemplates,
  defaultSend,
};
