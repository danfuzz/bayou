// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Functor } from 'util-common';

import TargetHandler from 'api-client/TargetHandler';

describe('api-common/TargetHandler', () => {
  describe('makeProxy()', () => {
    it('should make a proxy that wraps an appropriately-contructed instance of this class', () => {
      let gotTargetId;
      let gotFunctor;
      function sendMessage(targetId, functor) {
        gotTargetId = targetId;
        gotFunctor = functor;
        return `WOO ${targetId}+${functor.name}`;
      }

      function test(targetId, name, ...args) {
        const proxy = TargetHandler.makeProxy(sendMessage, targetId);

        const callResult = proxy[name](...args);
        assert.strictEqual(callResult, `WOO ${targetId}+${name}`);
        assert.strictEqual(gotTargetId, targetId);
        assert.isTrue(gotFunctor.equals(new Functor(name, ...args)));
      }

      test('what', 'is', 'the', 'meaning', 'of', 'this');
      test('do', 'you', ['have', 'stairs', 'in', 'your', 'house']);
    });
  });

  describe('constructor', () => {
    it('should accept valid arguments', () => {
      const func = () => { /*empty*/ };
      assert.doesNotThrow(() => new TargetHandler(func, 'some-target-id'));
    });

    it('should reject a non-callable `sendMessage` argument', () => {
      function test(value) {
        assert.throws(() => new TargetHandler(value, 'some-target-id'), /badValue/);
      }

      // Classes defined with `class ...` aren't callable.
      test(class { /* empty*/ });

      // Various non-functions.
      test(null);
      test(undefined);
      test(true);
      test('blort');
      test([1, 2, 3]);
      test(new Map());
    });

    it('should reject a non-id `targetId` argument', () => {
      function test(value) {
        const func = () => { /*empty*/ };
        assert.throws(() => new TargetHandler(func, value), /badValue/);
      }

      // Strings but not valid target IDs.
      test('');
      test('!@#!@#');

      // Various non-strings.
      test(null);
      test(undefined);
      test(true);
      test([1, 2, 3]);
      test(new Map());
    });
  });

  describe('apply()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      const proxy = new Proxy(func, th);
      assert.throws(() => th.apply(func, proxy, [1, 2, 3]), /badUse/);
    });
  });

  describe('construct()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      const proxy = new Proxy(func, th);
      assert.throws(() => th.construct(func, [1, 2, 3], proxy), /badUse/);
    });
  });

  describe('defineProperty()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.isFalse(th.defineProperty({}, 'blort', { value: 123 }));
    });
  });

  describe('deleteProperty()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.isFalse(th.deleteProperty({ blort: 10 }, 'blort'));
    });
  });

  describe('get()', () => {
    it('should return `undefined` for verboten property names', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');

      assert.isUndefined(th.get(Map, 'constructor'));

      const prom = new Promise(() => { /*empty*/ });
      assert.isUndefined(th.get(prom, 'then'));
      assert.isUndefined(th.get(prom, 'catch'));
    });

    it('should return a function which calls through to `sendMessage` for any allowed property name', () => {
      let gotTargetId;
      let gotFunctor;
      function sendMessage(targetId, functor) {
        gotTargetId = targetId;
        gotFunctor = functor;
        return `HEY ${targetId}+${functor.name}`;
      }

      function test(targetId, name, ...args) {
        const th = new TargetHandler(sendMessage, targetId);
        const proxy = new Proxy({}, th);
        const result = th.get({}, name, proxy);

        assert.isFunction(result);
        const callResult = result(...args);
        assert.strictEqual(callResult, `HEY ${targetId}+${name}`);
        assert.strictEqual(gotTargetId, targetId);
        assert.isTrue(gotFunctor.equals(new Functor(name, ...args)));
      }

      test('foo', 'bar', 1, 2, 3);
      test('hey', 'there', ['muffin']);
    });

    it('should return the same function upon a second-or-more call with the same name', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      const proxy = new Proxy({}, th);

      function test(name, expect = null) {
        const result = th.get({}, name, proxy);
        if (expect !== null) {
          assert.strictEqual(result, expect);
        }
        return result;
      }

      const foo = test('foo');
      test('foo', foo);
      test('foo', foo);
      test('foo', foo);

      const bar = test('bar');
      test('bar', bar);
      test('foo', foo);
      test('bar', bar);

      const zor = test('zor');
      test('zor', zor);
      test('bar', bar);
      test('foo', foo);
      test('bar', bar);
      test('zor', zor);
    });
  });

  describe('getOwnPropertyDescriptor()', () => {
    it('should always throw', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.throws(() => th.getOwnPropertyDescriptor({ blort: 123 }, 'blort'));
    });
  });

  describe('getPrototypeOf()', () => {
    it('should return the target\'s prototype', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      const obj = new Map();
      assert.strictEqual(th.getPrototypeOf(obj), Object.getPrototypeOf(obj));
    });
  });

  describe('has()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.isFalse(th.has({ blort: 10 }, 'blort'));
    });
  });

  describe('isExtensible()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.isFalse(th.isExtensible({}));
    });
  });

  describe('ownKeys()', () => {
    it('should always return `[]`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.deepEqual(th.ownKeys({ a: 10, b: 20 }), []);
    });
  });

  describe('preventExstensions()', () => {
    it('should always return `true`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      assert.isFalse(th.isExtensible({}));
    });
  });

  describe('set()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');
      const proxy = new Proxy(func, th);
      assert.isFalse(th.set({}, 'blort', 123, proxy));
    });
  });

  describe('setPrototypeOf()', () => {
    it('should always return `false`', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');

      assert.isFalse(th.setPrototypeOf({}, null));
      assert.isFalse(th.setPrototypeOf({}, {}));
    });
  });
});
