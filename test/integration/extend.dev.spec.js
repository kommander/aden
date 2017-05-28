const aden = require('../../lib/aden');
const expect = require('expect');

describe('Extension API (Attitudes)', () => {
  she('throws if a hook does not exist', () => {
    expect(() => aden({ dev: true })
      .hook('not-an-existing-hoook', () => true)
    ).toThrow(/I could not hook into/);
  });

  she('hooking the same handler twice for a hook throws', () => {
    const handler = () => true;
    expect(() => aden({ dev: true })
      .hook('load', handler)
      .hook('load', handler)
    ).toThrow(/a hook for that function already exists/);
  });

  she('can register and apply a hook', (done) => {
    aden({ dev: true })
      .registerHook('namespace:event')
      .hook('namespace:event', (args) => {
        expect(args.msg).toMatch('hello');
        done();
      })
      .applyHook('namespace:event', { msg: 'hello' });
  });

  she('can bulk register hooks', (done) => {
    aden({ dev: true })
      .registerHooks(['namespace:event', 'another:event'])
      .hook('another:event', (args) => {
        expect(args.msg).toMatch('hello');
        done();
      })
      .applyHook('another:event', { msg: 'hello' });
  });

  she('can unhook a registered function again', (done) => {
    const fn = (args) => {
      expect(args.msg).toMatch('hello');
      done();
    };

    const an = aden({ dev: true });
    an
      .registerHooks(['namespace:event', 'another:event'])
      .hook('namespace:event', fn)
      .hook('another:event', fn)
      .unhook('namespace:event', fn)
      .applyHook('namespace:event', { msg: 'hello' })
      .then(() => an.applyHook('another:event', { msg: 'hello' }));
  });

  she('throws for an unhook that does not exist', () => {
    expect(() => aden({ dev: true })
      .unhook('not-an-existing-hoook', () => true)
    ).toThrow(/a hook with that name does not exist/);
  });
});
