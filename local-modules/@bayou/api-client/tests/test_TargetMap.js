// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

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

      // **Note:** The proxy that we should be getting here is almost completely
      // transparent. This means that attempts to `inspect()` it, `instanceof`
      // it, etc., will result in the proxy being called upon to do those
      // things. So, the best that we can do is just call through it and see if
      // we get the expected behavior coming out the other end.
      const proxy = tm.add('xyz');
      proxy.florp(10);

      const got = mc.messages;

      assert.lengthOf(got, 1);

      const msg = got[0];

      assert.strictEqual(msg.targetId, 'xyz');
      assert.deepEqual(msg.payload, new Functor('florp', 10));
      assert.deepEqual(msg.rest, []);
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
});
