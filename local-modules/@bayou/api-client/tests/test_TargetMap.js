// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BearerToken } from '@bayou/api-common';
import { Functor } from '@bayou/util-common';

import { TargetMap } from '@bayou/api-client/TargetMap';

/**
 * Class which has a {@link #sendMessage} that when invoked remembers the
 * arguments it was called with, for later testing.
 */
class MessageCollector {
  constructor() {
    this.messages = [];
  }

  get sendMessage() {
    return (target, payload, ...rest) => {
      this.messages.push({ target, payload, rest });
    };
  }
}

/**
 * Checks that a given object is a target proxy hooked up to the expected
 * message send function.
 *
 * **Note:** The proxies produced by this module (as with JavaScript proxies in
 * general) should be almost completely transparent. This means that attempts to
 * `inspect()` them, test them with `instanceof`, etc., will result in calls on
 * proxies and not surface introspection. So, the best that we can do is just
 * call through the proxies and see if we get the expected behavior coming out
 * the other end.
 *
 * @param {*} proxy (Alleged) target proxy.
 * @param {MessageCollector} mc Expected object to receive messages.
 * @param {string|BearerToken} target Expected target.
 */
function checkProxy(proxy, mc, target) {
  function test(payload) {
    const inspectPayload = inspect(payload);

    mc.messages = [];

    proxy[payload.name](...payload.args);

    const got = mc.messages;

    assert.lengthOf(got, 1);

    const msg = got[0];

    assert.strictEqual(msg.target, target, inspectPayload);
    assert.deepEqual(msg.payload, payload, inspectPayload);
    assert.deepEqual(msg.rest, [], inspectPayload);
  }

  test(new Functor('blort'));
  test(new Functor('florp', 10));
  test(new Functor('zorch', 'a', ['b'], { c: ['d'] }));
}

describe('@bayou/api-client/TargetMap', () => {
  describe('constructor', () => {
    it('accepts a valid callable function argument', () => {
      const func = () => { /*empty*/ };
      assert.doesNotThrow(() => new TargetMap(func));
    });

    it('rejects invalid arguments', () => {
      function test(value) {
        assert.throws(() => new TargetMap(value), /badValue/);
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
  });

  describe('add()', () => {
    it('adds a previously-unbound string ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('xyz')); // Base assumption.

      const proxy = tm.add('xyz');

      checkProxy(proxy, mc, 'xyz');
    });

    it('adds a previously-unbound `BearerToken`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);
      const t  = new BearerToken('foo', 'foo-bar');

      assert.isNull(tm.getOrNull(t)); // Base assumption.

      const proxy = tm.add(t);

      checkProxy(proxy, mc, t);
    });

    it('refuses to add the same string ID twice', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('xyz')); // Base assumption.

      tm.add('xyz');

      assert.isNotNull(tm.getOrNull('xyz')); // Base assumption.
      assert.throws(() => tm.add('xyz'), /badUse/);
    });

    it('refuses to add the same string ID twice when originally added with `addOrGet()`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('xyz')); // Base assumption.

      tm.addOrGet('xyz');

      assert.isNotNull(tm.getOrNull('xyz')); // Base assumption.
      assert.throws(() => tm.add('xyz'), /badUse/);
    });
  });

  describe('addOrGet()', () => {
    it('adds a previously-unbound string ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy = tm.addOrGet('pdq');

      checkProxy(proxy, mc, 'pdq');
    });

    it('adds a previously-unbound `BearerToken`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);
      const t  = new BearerToken('foo', 'foo-bar');

      assert.isNull(tm.getOrNull(t)); // Base assumption.

      const proxy = tm.addOrGet(t);

      checkProxy(proxy, mc, t);
    });

    it('returns the same proxy when given the same string ID twice', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy1 = tm.addOrGet('pdq');

      assert.isNotNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy2 = tm.addOrGet('pdq');

      // `===` directly here and not `assert.strictEqual()` because in the
      // failure case we might otherwise end up calling through to the
      // (probable) proxy, which would probably _not_ provide any useful info
      // and very well might throw, thus obscuring the actual problem.
      assert.isTrue(proxy1 === proxy2);
    });

    it('returns the same proxy when given the same string ID as a previous `add()`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy1 = tm.add('pdq');

      assert.isNotNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy2 = tm.addOrGet('pdq');

      // See above in re `===` vs. `assert.strictEqual()`.
      assert.isTrue(proxy1 === proxy2);
    });
  });

  describe('clear()', () => {
    it('removes all targets', () => {
      const mc    = new MessageCollector();
      const tm    = new TargetMap(mc.sendMessage);
      const token = new BearerToken('foo', 'foo-bar');

      tm.add('foo');
      tm.add('bar');
      tm.add('baz');
      tm.add(token);

      tm.clear();

      assert.isNull(tm.getOrNull('foo'));
      assert.isNull(tm.getOrNull('bar'));
      assert.isNull(tm.getOrNull('baz'));
      assert.isNull(tm.getOrNull(token));
    });
  });

  describe('get()', () => {
    it('finds a string target added with `add()`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('zorch')); // Base assumption.
      const added = tm.add('zorch');

      const got = tm.get('zorch');
      assert.isTrue(got === added);

      checkProxy(got, mc, 'zorch');
    });

    it('finds a string target added with `addOrGet()`', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('zorch')); // Base assumption.
      const added = tm.addOrGet('zorch');

      const got = tm.get('zorch');
      assert.isTrue(got === added);

      checkProxy(got, mc, 'zorch');
    });

    it('throws when given an unbound ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.throws(() => tm.get('zorch'), /badUse/);
      assert.throws(() => tm.get(new BearerToken('x', 'x-zorch'), /badUse/));
    });
  });

  describe('getOrNull()', () => {
    it('finds a string target added with `add()`', () => {
      const mc    = new MessageCollector();
      const tm    = new TargetMap(mc.sendMessage);
      const added = tm.add('splort');
      const got   = tm.getOrNull('splort');

      assert.isTrue(got === added);

      checkProxy(got, mc, 'splort');
    });

    it('finds a `BearerToken` target added with `add()`', () => {
      const mc    = new MessageCollector();
      const tm    = new TargetMap(mc.sendMessage);
      const token = new BearerToken('zorch', 'zorch-splat');
      const added = tm.add(token);
      const got   = tm.getOrNull(token);

      assert.isTrue(got === added);

      checkProxy(got, mc, token);
    });

    it('finds a string target added with `addOrGet()`', () => {
      const mc    = new MessageCollector();
      const tm    = new TargetMap(mc.sendMessage);
      const added = tm.addOrGet('splort');
      const got   = tm.getOrNull('splort');

      assert.isTrue(got === added);

      checkProxy(got, mc, 'splort');
    });

    it('returns `null` when given an unbound ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('splort'));
      assert.isNull(tm.getOrNull(new BearerToken('x', 'x-zorch')));
    });
  });
});
