/**
 * Module dependencies.
 */

const Mocha = require('mocha');
const Suite = require('mocha/lib/suite');
const Test = require('mocha/lib/test');
const escapeRe = require('escape-string-regexp');

/**
 * BDD-style interface:
 *
 *      describe('Array', function() {
 *        describe('#indexOf()', function() {
 *          she('should return -1 when not present', function() {
 *            // ...
 *          });
 *
 *          she('should return the index when present', function() {
 *            // ...
 *          });
 *        });
 *      });
 *
 * @param {Suite} suite Root suite.
 */
 /* istanbul ignore next */
module.exports = Mocha.interfaces['she-bdd'] = function sheBdd(suite) {
  const suites = [suite];

  suite.on('pre-require', (context, file, mocha) => {
    const common = require('mocha/lib/interfaces/common')(suites, context);

    /* eslint-disable no-param-reassign */
    context.before = common.before;
    context.after = common.after;
    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;
    context.run = mocha.options.delay && common.runWithSuite(suite);

    /**
     * Describe a "suite" with the given `title`
     * and callback `fn` containing nested suites
     * and/or tests.
     */
    context.describe = context.context = function contextFn(title, fn) {
      const newSuite = Suite.create(suites[0], title);
      newSuite.file = file;
      suites.unshift(newSuite);
      fn.call(newSuite);
      suites.shift();
      return newSuite;
    };

    /**
     * Pending describe.
     */
    context.xdescribe = context.xcontext = context.describe.skip = function describeFn(title, fn) {
      const newSuite = Suite.create(suites[0], title);
      newSuite.pending = true;
      suites.unshift(newSuite);
      fn.call(newSuite);
      suites.shift();
    };

    /**
     * Exclusive suite.
     */
    context.describe.only = function onlyFn(title, fn) {
      const newSuite = context.describe(title, fn);
      mocha.grep(newSuite.fullTitle());
      return newSuite;
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */
    const she = context.she = context.specify = function specifyFn(title, fn) {
      const newSuite = suites[0];
      if (newSuite.pending) {
        fn = null;
      }
      const test = new Test(title, fn);
      test.file = file;
      newSuite.addTest(test);
      return test;
    };

    /**
     * Exclusive test-case.
     */

    context.she.only = function sheOnlyFn(title, fn) {
      const test = she(title, fn);
      const reString = ['^', escapeRe(test.fullTitle()), '$'].join('');
      mocha.grep(new RegExp(reString));
      return test;
    };

    /**
     * Pending test case.
     */

    context.xit = context.xspecify = context.she.skip = function xspecifyFn(title) {
      context.she(title);
    };

    /**
     * Number of attempts to retry.
     */
    context.she.retries = function retriesFn(n) {
      context.retries(n);
    };
  });
};
