// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { Functor } from '@bayou/util-common';

import { TargetHandler } from '@bayou/api-client/TargetHandler';

describe('@bayou/api-client/TargetHandler', () => {
  describe('makeProxy()', () => {
    it('makes a proxy that wraps an appropriately-contructed instance of this class', () => {
      let gotTarget;
      let gotFunctor;
      function sendMessage(target, functor) {
        gotTarget  = target;
        gotFunctor = functor;
        return `WOO ${target}+${functor.name}`;
      }

      function test(target, name, ...args) {
        const proxy = TargetHandler.makeProxy(sendMessage, target);

        const callResult = proxy[name](...args);
        assert.strictEqual(callResult, `WOO ${target}+${name}`);
        assert.strictEqual(gotTarget, target);
        assert.isTrue(gotFunctor.equals(new Functor(name, ...args)));
      }

      test('what', 'is', 'the', 'meaning', 'of', 'this');
      test('do', 'you', ['have', 'stairs', 'in', 'your', 'house']);
    });
  });

  describe('constructor', () => {
    it('accepts valid arguments', () => {
      const func = () => { /*empty*/ };
      assert.doesNotThrow(() => new TargetHandler(func, 'some-target-id'));
      assert.doesNotThrow(() => new TargetHandler(func, new BearerToken('xyz', 'xyz-pdq')));
    });

    it('rejects a non-callable `sendMessage` argument', () => {
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

    it('rejects a non-id non-`BearerToken` `idOrTarget` argument', () => {
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

  describe('get()', () => {
    it('returns `undefined` for verboten property names', () => {
      const func = () => { throw new Error('should not have been called'); };
      const th = new TargetHandler(func, 'some-target-id');

      assert.isUndefined(th.get(Map, 'constructor'));

      const prom = new Promise(() => { /*empty*/ });
      assert.isUndefined(th.get(prom, 'then'));
      assert.isUndefined(th.get(prom, 'catch'));
    });

    it('returns a function which calls through to `sendMessage` for any allowed property name', () => {
      let gotTarget;
      let gotFunctor;
      function sendMessage(target, functor) {
        gotTarget = target;
        gotFunctor = functor;
        return `HEY ${target}+${functor.name}`;
      }

      function test(target, name, ...args) {
        const th = new TargetHandler(sendMessage, target);
        const proxy = new Proxy({}, th);
        const result = th.get({}, name, proxy);

        assert.isFunction(result);
        const callResult = result(...args);
        assert.strictEqual(callResult, `HEY ${target}+${name}`);
        assert.strictEqual(gotTarget, target);
        assert.isTrue(gotFunctor.equals(new Functor(name, ...args)));
      }

      test('foo', 'bar', 1, 2, 3);
      test('hey', 'there', ['muffin']);
      test(new BearerToken('florp', 'florp-like'), 'boop', ['dee', 'doop']);
    });

    it('returns the same function upon a second-or-more call with the same name', () => {
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
});
