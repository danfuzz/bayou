// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { MethodCacheProxyHandler } from '@bayou/util-common';

/**
 * Subclass of the class to test which always throws when asked to create a
 * method handler.
 */
class ThrowingHandler extends MethodCacheProxyHandler {
  _impl_forMethod(name_unused) {
    throw new Error('Should not have been called.');
  }
}

describe('@bayou/util-common/MethodCacheProxyHandler', () => {
  describe('constructor', () => {
    it('should construct an instance', () => {
      assert.doesNotThrow(() => new MethodCacheProxyHandler());
    });
  });

  describe('apply()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new ThrowingHandler();
      const proxy = new Proxy(func, th);
      assert.throws(() => th.apply(func, proxy, [1, 2, 3]), /badUse/);
    });
  });

  describe('construct()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new ThrowingHandler();
      const proxy = new Proxy(func, th);
      assert.throws(() => th.construct(func, [1, 2, 3], proxy), /badUse/);
    });
  });

  describe('defineProperty()', () => {
    it('should always return `false`', () => {
      const th = new ThrowingHandler();
      assert.isFalse(th.defineProperty({}, 'blort', { value: 123 }));
    });
  });

  describe('deleteProperty()', () => {
    it('should always return `false`', () => {
      const th = new ThrowingHandler();
      assert.isFalse(th.deleteProperty({ blort: 10 }, 'blort'));
    });
  });

  describe('get()', () => {
    it('should return `undefined` for verboten property names', () => {
      const th = new ThrowingHandler();

      assert.isUndefined(th.get(Map, 'constructor'));

      const prom = new Promise(() => { /*empty*/ });
      assert.isUndefined(th.get(prom, 'then'));
      assert.isUndefined(th.get(prom, 'catch'));
    });

    it('should return a function gotten from a call to the `_impl`', () => {
      const handler = new MethodCacheProxyHandler();
      const proxy   = new Proxy({}, handler);

      handler._impl_methodFor = (name) => {
        const result = () => { return; };
        result.blorp = `blorp-${name}`;
        return result;
      };

      const result = handler.get({}, 'bloop', proxy);
      assert.strictEqual(result.blorp, 'blorp-bloop');
    });

    it('should return the same function upon a second-or-more call with the same name', () => {
      const handler = new MethodCacheProxyHandler();
      const proxy   = new Proxy({}, handler);

      handler._impl_methodFor = (name) => {
        const result = () => { return; };
        result.blorp = `blorp-${name}`;
        return result;
      };

      const result1a = handler.get({}, 'zip', proxy);
      const result2a = handler.get({}, 'zot', proxy);
      const result1b = handler.get({}, 'zip', proxy);
      const result2b = handler.get({}, 'zot', proxy);

      assert.strictEqual(result1a.blorp, 'blorp-zip');
      assert.strictEqual(result2a.blorp, 'blorp-zot');
      assert.strictEqual(result1a, result1b);
      assert.strictEqual(result2a, result2b);
    });
  });

  describe('getOwnPropertyDescriptor()', () => {
    it('should always throw', () => {
      const th = new ThrowingHandler();
      assert.throws(() => th.getOwnPropertyDescriptor({ blort: 123 }, 'blort'));
    });
  });

  describe('getPrototypeOf()', () => {
    it('should return the target\'s prototype', () => {
      const th = new ThrowingHandler();
      const obj = new Map();
      assert.strictEqual(th.getPrototypeOf(obj), Object.getPrototypeOf(obj));
    });
  });

  describe('has()', () => {
    it('should always return `false`', () => {
      const th = new ThrowingHandler();
      assert.isFalse(th.has({ blort: 10 }, 'blort'));
    });
  });

  describe('isExtensible()', () => {
    it('should always return `false`', () => {
      const th = new ThrowingHandler();
      assert.isFalse(th.isExtensible({}));
    });
  });

  describe('ownKeys()', () => {
    it('should always return `[]`', () => {
      const th = new ThrowingHandler();
      assert.deepEqual(th.ownKeys({ a: 10, b: 20 }), []);
    });
  });

  describe('preventExstensions()', () => {
    it('should always return `true`', () => {
      const th = new ThrowingHandler();
      assert.isTrue(th.preventExtensions({}));
    });
  });

  describe('set()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new ThrowingHandler();
      const proxy = new Proxy(func, th);
      assert.isFalse(th.set({}, 'blort', 123, proxy));
    });
  });

  describe('setPrototypeOf()', () => {
    it('should always return `false`', () => {
      const th = new ThrowingHandler();

      assert.isFalse(th.setPrototypeOf({}, null));
      assert.isFalse(th.setPrototypeOf({}, {}));
    });
  });
});
