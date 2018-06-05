// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseProxyHandler } from '@bayou/util-common';

describe('@bayou/util-common/BaseProxyHandler', () => {
  describe('makeProxy', () => {
    it('should construct a proxy around an instance of the called-upon subclass', () => {
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
    it('should construct an instance', () => {
      assert.doesNotThrow(() => new BaseProxyHandler());
    });
  });

  describe('apply()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.throws(() => bph.apply(func, proxy, [1, 2, 3]), /badUse/);
    });
  });

  describe('construct()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.throws(() => bph.construct(func, [1, 2, 3], proxy), /badUse/);
    });
  });

  describe('defineProperty()', () => {
    it('should always return `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.defineProperty({}, 'blort', { value: 123 }));
    });
  });

  describe('deleteProperty()', () => {
    it('should always return `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.deleteProperty({ blort: 10 }, 'blort'));
    });
  });

  describe('get()', () => {
    it('should always return `undefined`', () => {
      const bph = new BaseProxyHandler();

      assert.isUndefined(bph.get({}, 'x', {}));
      assert.isUndefined(bph.get({}, 'florp', {}));
    });
  });

  describe('getOwnPropertyDescriptor()', () => {
    it('should always throw', () => {
      const bph = new BaseProxyHandler();
      assert.throws(() => bph.getOwnPropertyDescriptor({ blort: 123 }, 'blort'));
    });
  });

  describe('getPrototypeOf()', () => {
    it('should return the target\'s prototype', () => {
      const bph = new BaseProxyHandler();
      const obj = new Map();
      assert.strictEqual(bph.getPrototypeOf(obj), Object.getPrototypeOf(obj));
    });
  });

  describe('has()', () => {
    it('should always return `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.has({ blort: 10 }, 'blort'));
    });
  });

  describe('isExtensible()', () => {
    it('should always return `false`', () => {
      const bph = new BaseProxyHandler();
      assert.isFalse(bph.isExtensible({}));
    });
  });

  describe('ownKeys()', () => {
    it('should always return `[]`', () => {
      const bph = new BaseProxyHandler();
      assert.deepEqual(bph.ownKeys({ a: 10, b: 20 }), []);
    });
  });

  describe('preventExstensions()', () => {
    it('should always return `true`', () => {
      const bph = new BaseProxyHandler();
      assert.isTrue(bph.preventExtensions({}));
    });
  });

  describe('set()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const bph = new BaseProxyHandler();
      const proxy = new Proxy(func, bph);
      assert.isFalse(bph.set({}, 'blort', 123, proxy));
    });
  });

  describe('setPrototypeOf()', () => {
    it('should always return `false`', () => {
      const bph = new BaseProxyHandler();

      assert.isFalse(bph.setPrototypeOf({}, null));
      assert.isFalse(bph.setPrototypeOf({}, {}));
    });
  });
});
