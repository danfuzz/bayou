// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Functor } from '@bayou/util-common';

import TargetMap from '@bayou/api-client/TargetMap';

/**
 * Class which has a {@link #sendMessage} that when invoked remembers the
 * arguments it was called with, for later testing.
 */
class MessageCollector {
  constructor() {
    this.messages = [];
  }

  get sendMessage() {
    return (targetId, payload, ...rest) => {
      this.messages.push({ targetId, payload, rest });
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
 * @param {string} targetId Expected target ID.
 */
function checkProxy(proxy, mc, targetId) {
  function test(payload) {
    const inspectPayload = inspect(payload);

    mc.messages = [];

    proxy[payload.name](...payload.args);

    const got = mc.messages;

    assert.lengthOf(got, 1);

    const msg = got[0];

    assert.strictEqual(msg.targetId, targetId, inspectPayload);
    assert.deepEqual(msg.payload, payload, inspectPayload);
    assert.deepEqual(msg.rest, [], inspectPayload);
  }

  test(new Functor('blort'));
  test(new Functor('florp', 10));
  test(new Functor('zorch', 'a', ['b'], { c: ['d'] }));
}

describe('@bayou/api-client/TargetMap', () => {
  describe('constructor', () => {
    it('should accept a valid callable function argument', () => {
      const func = () => { /*empty*/ };
      assert.doesNotThrow(() => new TargetMap(func));
    });

    it('should reject invalid arguments', () => {
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
    it('should add a previously-unbound ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('xyz')); // Base assumption.

      const proxy = tm.add('xyz');

      checkProxy(proxy, mc, 'xyz');
    });

    it('should refuse to add the same ID twice', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('xyz')); // Base assumption.

      tm.add('xyz');

      assert.isNotNull(tm.getOrNull('xyz')); // Base assumption.
      assert.throws(() => tm.add('xyz'), /badUse/);
    });
  });

  describe('addOrGet()', () => {
    it('should add a previously-unbound ID', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy = tm.addOrGet('pdq');

      checkProxy(proxy, mc, 'pdq');
    });

    it('should return the same proxy when given the same ID twice', () => {
      const mc = new MessageCollector();
      const tm = new TargetMap(mc.sendMessage);

      assert.isNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy1 = tm.addOrGet('pdq');

      assert.isNotNull(tm.getOrNull('pdq')); // Base assumption.

      const proxy2 = tm.addOrGet('pdq');

      assert.isTrue(proxy1 === proxy2);
    });
  });
});
