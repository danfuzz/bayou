// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseProxyHandler } from '@bayou/util-common';

describe('@bayou/util-common/BaseProxyHandler', () => {
  describe('makeFunctionProxy()', () => {
    it('constructs a function-like proxy around an instance of the called-upon subclass', () => {
      let gotArgs     = null;
      let gotProperty = null;
      let gotTarget   = null;
      let gotThis     = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        apply(target, thisArg, args) {
          gotTarget = target;
          gotThis   = thisArg;
          gotArgs   = args;

          return 'boop';
        }

        get(target, property, receiver_unused) {
          gotTarget   = target;
          gotProperty = property;
        }
      }

      const proxy = Subclass.makeFunctionProxy('x', 'y', 'z');

      assert.deepEqual(gotArgs, ['x', 'y', 'z']);

      assert.isUndefined(proxy.florp);
      assert.frozen(gotTarget);
      assert.isFunction(gotTarget);
      assert.strictEqual(gotProperty, 'florp');

      const callResult = proxy(1, 2, 3);
      assert.strictEqual(callResult, 'boop');
      assert.isFunction(gotTarget);
      assert.isUndefined(gotThis);
      assert.deepEqual(gotArgs, [1, 2, 3]);

      const someThis = { yes: 'yes', p: proxy };
      someThis.p('xyz');
      assert.strictEqual(gotThis, someThis);
      assert.deepEqual(gotArgs, ['xyz']);
    });
  });

  describe('makeProxy()', () => {
    it('constructs a proxy around an instance of the called-upon subclass', () => {
      let gotArgs = null;
      let gotTarget = null;
      let gotProperty = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        get(target, property, receiver_unused) {
          gotTarget = target;
          gotProperty = property;
        }
      }

      const proxy = Subclass.makeProxy('x', 'y', 'z');

      assert.deepEqual(gotArgs, ['x', 'y', 'z']);

      assert.isUndefined(proxy.florp);
      assert.deepEqual(gotTarget, {});
      assert.frozen(gotTarget);
      assert.strictEqual(gotProperty, 'florp');
    });
  });

  describe('constructor', () => {
    it('constructs an instance', () => {
      assert.doesNotThrow(() => new BaseProxyHandler());
    });
  });

  describe('apply()', () => {
    it('always throws', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.throws(() => bph.apply(func, proxy, [1, 2, 3]), /badUse/);
    });
  });

  describe('construct()', () => {
    it('always throws', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.throws(() => bph.construct(func, [1, 2, 3], proxy), /badUse/);
    });
  });

  describe('defineProperty()', () => {
    it('always returns `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.defineProperty({}, 'blort', { value: 123 }));
    });
  });

  describe('deleteProperty()', () => {
    it('always returns `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.deleteProperty({ blort: 10 }, 'blort'));
    });
  });

  describe('get()', () => {
    it('always returns `undefined`', () => {
      const bph = new BaseProxyHandler();

      assert.isUndefined(bph.get({}, 'x', {}));
      assert.isUndefined(bph.get({}, 'florp', {}));
    });
  });

  describe('getOwnPropertyDescriptor()', () => {
    it('always throws', () => {
      const bph = new BaseProxyHandler();
      assert.throws(() => bph.getOwnPropertyDescriptor({ blort: 123 }, 'blort'));
    });
  });

  describe('getPrototypeOf()', () => {
    it('returns the target\'s prototype', () => {
      const bph = new BaseProxyHandler();
      const obj = new Map();
      assert.strictEqual(bph.getPrototypeOf(obj), Object.getPrototypeOf(obj));
    });
  });

  describe('has()', () => {
    it('always returns `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.has({ blort: 10 }, 'blort'));
    });
  });

  describe('isExtensible()', () => {
    it('always returns `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.isExtensible({}));
    });
  });

  describe('ownKeys()', () => {
    it('always returns `[]`', () => {
      const bph = new BaseProxyHandler();
      assert.deepEqual(bph.ownKeys({ a: 10, b: 20 }), []);
    });
  });

  describe('preventExstensions()', () => {
    it('always returns `true`', () => {
      const bph = new BaseProxyHandler();
      assert.isTrue(bph.preventExtensions({}));
    });
  });

  describe('set()', () => {
    it('always returns `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.isFalse(bph.set({}, 'blort', 123, proxy));
    });
  });

  describe('setPrototypeOf()', () => {
    it('always returns `false`', () => {
      const bph = new BaseProxyHandler();

      assert.isFalse(bph.setPrototypeOf({}, null));
      assert.isFalse(bph.setPrototypeOf({}, {}));
    });
  });
});
