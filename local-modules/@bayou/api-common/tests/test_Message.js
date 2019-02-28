// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken, Message } from '@bayou/api-common';
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

    it('accepts `BearerToken` instances for `targetId`', () => {
      assert.doesNotThrow(() => new Message(0, new BearerToken('abc', 'def'), VALID_FUNCTOR));
    });

    it('rejects strings which aren\'t in the propert syntax for `targetId`', () => {
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));
      assert.throws(() => new Message(37, '/', VALID_FUNCTOR));
      assert.throws(() => new Message(37, '%zorch*', VALID_FUNCTOR));
    });

    it('rejects non-string non-`BearerToken`s for `targetId`', () => {
      assert.throws(() => new Message(37, 37, VALID_FUNCTOR));
      assert.throws(() => new Message(37, false, VALID_FUNCTOR));
      assert.throws(() => new Message(37, null, VALID_FUNCTOR));
      assert.throws(() => new Message(37, undefined, VALID_FUNCTOR));
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));
      assert.throws(() => new Message(37, new Map(), VALID_FUNCTOR));
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

  describe('.logInfo', () => {
    it('has all the constructed arguments if `targetId` was constructed as a string', () => {
      const msg    = new Message(123, 'target-yep', VALID_FUNCTOR);
      const result = msg.logInfo;

      assert.deepEqual(result, { id: 123, targetId: 'target-yep', payload: VALID_FUNCTOR });
    });

    it('has the token\'s `safeString` if the instance was constructed with a `BearerToken`', () => {
      const token = new BearerToken('florp', 'florp-like');
      const msg   = new Message(914, token, VALID_FUNCTOR);
      const result = msg.logInfo;

      assert.deepEqual(result, { id: 914, targetId: token.safeString, payload: VALID_FUNCTOR });
    });
  });

  describe('.payload', () => {
    it('is the constructed `payload`', () => {
      const msg = new Message(123, 'target', VALID_FUNCTOR);

      assert.strictEqual(msg.payload, VALID_FUNCTOR);
    });
  });

  describe('.targetId', () => {
    it('is the constructed `targetId` if it was a string', () => {
      const msg = new Message(123, 'target-yep', VALID_FUNCTOR);

      assert.strictEqual(msg.targetId, 'target-yep');
    });

    it('is the token\'s `secretToken` if the instance was constructed with a `BearerToken`', () => {
      const token = new BearerToken('florp', 'florp-like');
      const msg   = new Message(123, token, VALID_FUNCTOR);

      assert.strictEqual(msg.targetId, token.secretToken);
    });
  });

  describe('deconstruct()', () => {
    it('is an array of the three constructor arguments, if constructed with a string for `targetId`', () => {
      const token = new BearerToken('boop', 'beep-boop');
      const msg   = new Message(914, token, VALID_FUNCTOR);
      const result = msg.deconstruct();

      assert.deepEqual(result, [914, token.secretToken, VALID_FUNCTOR]);
    });

    it('is an array that includes the token\'s `secretToken` if the instance was constructed with a `BearerToken`', () => {
      const token = new BearerToken('florp', 'florp-like');
      const msg   = new Message(123, token, VALID_FUNCTOR);

      assert.strictEqual(msg.targetId, token.secretToken);
    });
  });
});
