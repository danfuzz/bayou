// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Message } from '@bayou/api-common';
import { Functor } from '@bayou/util-common';

/** {Functor} Valid functor to use in tests. */
const VALID_FUNCTOR = new Functor('blort', 37, 914);

describe('@bayou/api-common/Message', () => {
  describe('constructor()', () => {
    it('accepts non-negative integer `id`s', () => {
      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(37, 'target', VALID_FUNCTOR));
    });

    it('accepts string `id`s of appropriate length', () => {
      assert.doesNotThrow(() => new Message('12345678', 'target', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message('abcdefghijklmnop', 'target', VALID_FUNCTOR));
    });

    it('rejects `id`s which are not non-negative integers or appropriate-length strings', () => {
      assert.throws(() => new Message('', 'foo', VALID_FUNCTOR));
      assert.throws(() => new Message('nope', 'foo', VALID_FUNCTOR));
      assert.throws(() => new Message('nopenop', 'foo', VALID_FUNCTOR));
      assert.throws(() => new Message(3.7, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(true, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(null, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(undefined, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(-1, 'target', VALID_FUNCTOR));
    });

    it('accepts valid ID strings for `targetId`', () => {
      assert.doesNotThrow(() => new Message(0, 'a', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, 'A', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, '_', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, '-', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, '.', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, 'fooBar', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, 'x-y.z_pdq', VALID_FUNCTOR));
    });

    it('rejects strings which aren\'t in the propert syntax for `targetId`', () => {
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));
      assert.throws(() => new Message(37, '/', VALID_FUNCTOR));
      assert.throws(() => new Message(37, '%zorch*', VALID_FUNCTOR));
    });

    it('rejects non-strings for `targetId`', () => {
      assert.throws(() => new Message(37, 37, VALID_FUNCTOR));
      assert.throws(() => new Message(37, false, VALID_FUNCTOR));
      assert.throws(() => new Message(37, null, VALID_FUNCTOR));
      assert.throws(() => new Message(37, undefined, VALID_FUNCTOR));
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));
    });

    it('accepts a functor for `payload`', () => {
      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
    });

    it('rejects a non-functor `payload`', () => {
      assert.throws(() => new Message(0, 'target', null));
      assert.throws(() => new Message(0, 'target', 'blort'));
      assert.throws(() => new Message(0, 'target', { name: 'x', args: [] }));
    });

    it('returns a frozen object', () => {
      const message = new Message(0, 'target', VALID_FUNCTOR);
      assert.isFrozen(message);
    });
  });

  describe('.id', () => {
    it('is the constructed `id`', () => {
      const msg1 = new Message(1234, 'target', VALID_FUNCTOR);
      const msg2 = new Message('xyzxyzxyz', 'target', VALID_FUNCTOR);

      assert.strictEqual(msg1.id, 1234);
      assert.strictEqual(msg2.id, 'xyzxyzxyz');
    });
  });

  describe('.payload', () => {
    it('is the constructed `payload`', () => {
      const msg = new Message(123, 'target', VALID_FUNCTOR);

      assert.strictEqual(msg.payload, VALID_FUNCTOR);
    });
  });

  describe('.targetId', () => {
    it('is the constructed `targetId`', () => {
      const msg = new Message(123, 'target-yep', VALID_FUNCTOR);

      assert.strictEqual(msg.targetId, 'target-yep');
    });
  });

  describe('withTargetId()', () => {
    it('returns an instance with a replaced `targetId`', () => {
      const msg    = new Message(123, 'target-first', VALID_FUNCTOR);
      const result = msg.withTargetId('target-second');

      assert.strictEqual(result.targetId, 'target-second');
      assert.strictEqual(result.id, 123);
      assert.strictEqual(result.payload, VALID_FUNCTOR);
    });

    it('rejects an invalid `targetId`', () => {
      const msg = new Message(123, 'target-first', VALID_FUNCTOR);

      function test(tid) {
        assert.throws(() => msg.withTargetId(tid), /badValue/);
      }

      test(null);
      test(123);
      test('');
      test('&');
    });
  });
});
