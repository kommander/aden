const aden = require('../../lib/aden');
const path = require('path');
const expect = require('expect');
const sinon = require('sinon');
const Logger = require('../../lib/aden.logger');
const TestDuplex = require('../lib/test-duplex.js');

describe('Deploy', () => {
  she('logs a warning for non existent deploy target', (done) => {
    const ad = aden();
    const spy = sinon.spy(ad.log, 'warn');

    ad
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy'))
      .then((an) => {
        expect(spy.callCount).toEqual(1);
        an.shutdown(done);
      });
  });

  she('runs no deploy if non-existing target was specified (default)', (done) => {
    aden()
      .registerDeployTarget('heroku', {
        fn: sinon.spy(),
      })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy'))
      .then((an) => {
        expect(an.deployTargets.heroku.fn.callCount).toEqual(0);
        an.shutdown(done);
      });
  });

  she('runs default deploy if target was matched', (done) => {
    aden()
      .registerDeployTarget('default', {
        fn: sinon.spy(),
      })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy'))
      .then((an) => {
        expect(an.deployTargets.default.fn.callCount).toEqual(1);
        an.shutdown(done);
      });
  });

  she('logs an error when registering another target with the same name', (done) => {
    const stream = new TestDuplex();
    const logParser = Logger.getLogParser();
    logParser.attach(stream);
    
    logParser.on('error', (err) => {
      expect(err.message).toMatch(/I could not register deployTarget, because it already exists\. \(default\)/);
    });

    aden({
      logger: {
        silent: false,
        stdStream: stream,
        errStream: stream,
      },
    })
    .registerDeployTarget('default', {
      fn: sinon.spy(),
    })
    .registerDeployTarget('default', {
      fn: sinon.spy(),
    })
    .init(path.resolve(__dirname, '../tmpdata/emptypath'))
    .then((an) => an.run('build'))
    .then((an) => an.run('deploy'))
    .then((an) => {
      expect(an.deployTargets.default.fn.callCount).toEqual(1);
      an.shutdown(done);
    });
  });

  she('runs deploy if target was matched', (done) => {
    aden()
      .registerDeployTarget('heroku', {
        fn: sinon.spy(),
      })
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy', { target: 'heroku' }))
      .then((an) => {
        expect(an.deployTargets.heroku.fn.callCount).toEqual(1);
        an.shutdown(done);
      });
  });

  she('does not execute deploy hooks if no target was matched', (done) => {
    const h1 = sinon.spy();
    const h2 = sinon.spy();
    const h3 = sinon.spy();

    aden()
      .hook('pre:deploy', h1)
      .hook('deploy', h2)
      .hook('post:deploy', h3)
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy'))
      .then((an) => {
        expect(h1.callCount).toEqual(0);
        expect(h2.callCount).toEqual(0);
        expect(h3.callCount).toEqual(0);
        an.shutdown(done);
      });
  });

  she('executes deploy hooks if target was matched', (done) => {
    const h1 = sinon.spy();
    const h2 = sinon.spy();
    const h3 = sinon.spy();

    aden()
      .registerDeployTarget('heroku', {
        fn: sinon.spy(),
      })
      .hook('pre:deploy', h1)
      .hook('deploy', h2)
      .hook('post:deploy', h3)
      .init(path.resolve(__dirname, '../tmpdata/basics'))
      .then((an) => an.run('build'))
      .then((an) => an.run('deploy', { target: 'heroku' }))
      .then((an) => {
        expect(h1.callCount).toEqual(1);
        expect(h2.callCount).toEqual(1);
        expect(h3.callCount).toEqual(1);
        an.shutdown(done);
      });
  });
});
