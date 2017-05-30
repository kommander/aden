'use strict';

const path = require('path');
const loggerMiddleware = require('morgan');
const cannot = require('brokens');
const packageJson = require('../package.json');

process.__ADEN__ = false;

function buildTask() {
  // TODO: Force build only to be production env
  return Promise.resolve(this.pages)
    .then((pages) => this.parseGraphs(pages))
    .then((pages) => this.postParseLoadSetup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfigs }) =>
      this.clean(pages)
        .then(() => this.build(pages, webpackConfigs))
    )
    .then(() => this);
}

function cleanTask() {
  return this.clean()
    .then(() => this);
}

function runDevTask() {
  return Promise.resolve(this.pages)
    .then((pages) => this.parseGraphs(pages))
    .then((pages) => this.postParseLoadSetup(pages))
    .then(({ pages }) => this.generateWebpackConfig(pages))
    .then(({ pages, webpackConfigs }) =>
      this.clean(pages)
        .then(() => this.build(pages, webpackConfigs)
    ))
    .then(({ pages, webpackConfigs }) => this.setupDev(pages, webpackConfigs))
    .then(({ pages }) => this.runStartupCallback({ pages }))
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

function runProductionTask() {
  return this.loadBuild(this.rootPage)
    .then((pages) => this.postBuildLoadSetup(pages))
    .then(({ pages }) => this.runStartupCallback({ pages }))
    .then(({ pages }) => this.setupApp(pages[0]))
    .then(() => this);
}

function runDeployTask(opts = {}) {
  return this.loadBuild(this.rootPage)
    .then((pages) => this.postBuildLoadSetup(pages))
    .then((pages) => {
      const target = opts.target || 'default';
      const targetFn = (this.deployTargets[target] || {}).fn;
      if (!targetFn) {
        this.log.warn(`No deploy target for ${target}`);
        return { pages, target };
      }

      return Promise.resolve()
        .then(() => this.applyHook('pre:deploy', { pages, target }))
        .then(() => this.applyHook('deploy', { pages, target }))
        .then((args) => targetFn(args))
        .then(() => this.applyHook('post:deploy', { pages, target }));
    })
    .then(() => this);
}

function init(initPath, focusPath) {
  if (process.__ADEN__) {
    throw new Error('Fatal: Only call aden.init() once per process.');
  }
  process.__ADEN__ = true;

  const rootPath = this.rootPath = path.resolve(initPath);
  this.focusPath = focusPath || false;

  try {
    const appPackageJson = require(path.resolve(rootPath, 'package.json'));
    this.name = appPackageJson.name;
  } catch (ex) {
    this.name = path.parse(rootPath).name.toUpperCase();
  }

  this.version = packageJson.version;

  // Access Log
  const log = loggerMiddleware(this.settings.logger.format, {
    stream: {
      write: (buffer) => {
        const buf = buffer.replace(/\n/ig, '');
        this.log.raw(buf);
      },
    },
  });

  // Apply default access logger
  this.app.use(log);

  this.log.debug('Initializing Aden', {
    rootPath, focusPath, settings: this.settings,
  });

  // TODO: use hooks from dev setup to apply
  if (this.isDEV) {
    this.app.use((req, res, next) => {
      this.devHotMiddleware(req, res, next);
    });
  }

  this.tasks = {
    build: buildTask,
    clean: cleanTask,
    dev: runDevTask,
    production: runProductionTask,
    deploy: runDeployTask,
  };

  this.rootPage = this.registerPage(rootPath);

  return this.loadDotServerFile(rootPath, true)
    .then((fileConfig) => {
      let dist = process.env.ADEN_DIST || fileConfig.dist || this.settings.dist;

      if (!path.isAbsolute(dist)) {
        dist = path.resolve(this.rootPath, dist);
      }

      Object.assign(this.settings, {
        dist,
      });
    })
    .then(() => this.applyHook('init', { rootPage: this.rootPage }))
    .then(() => this);
}

function run(task, opts) {
  return Promise.resolve().then(() => {
    const taskFn = this.tasks[task];
    if (!taskFn) {
      throw cannot('run', task).because('it does not exist');
    }
    return taskFn.call(this, opts);
  });
}

function runStartupCallback({ pages }) {
  if (typeof pages[0].startup.value === 'function') {
    return Promise.resolve()
      .then(() => pages[0].startup.value(this))
      .then(() => ({ pages }));
  }
  return Promise.resolve({ pages });
}

module.exports = {
  init,
  run,
  runStartupCallback,
};
