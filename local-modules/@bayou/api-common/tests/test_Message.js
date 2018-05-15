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
    it('should accept non-negative integer ids', () => {
      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(37, 'target', VALID_FUNCTOR));
    });

    it('should reject ids which are not non-negative integers', () => {
      assert.throws(() => new Message('this better not work!', 'foo', VALID_FUNCTOR));
      assert.throws(() => new Message(3.7, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(true, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(null, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(undefined, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(-1, 'target', VALID_FUNCTOR));
    });

    it('should accept non-empty target strings', () => {
      assert.doesNotThrow(() => new Message(0, 'a', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, 'A', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, '_', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(0, 'fooBar', VALID_FUNCTOR));
    });

    it('should reject targets that are not non-empty strings', () => {
      assert.throws(() => new Message(37, 37, VALID_FUNCTOR));
      assert.throws(() => new Message(37, false, VALID_FUNCTOR));
      assert.throws(() => new Message(37, null, VALID_FUNCTOR));
      assert.throws(() => new Message(37, undefined, VALID_FUNCTOR));
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));
    });

    it('should accept a functor for the payload', () => {
      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
    });

    it('should reject a payload that is not a functor', () => {
      assert.throws(() => new Message(0, 'target', null));
      assert.throws(() => new Message(0, 'target', 'blort'));
      assert.throws(() => new Message(0, 'target', { name: 'x', args: [] }));
    });

    it('should return a frozen object', () => {
      const message = new Message(0, 'target', VALID_FUNCTOR);
      assert.isFrozen(message);
    });
  });

  describe('.id', () => {
    it('should return the constructed message id', () => {
      const msg = new Message(1234, 'target', VALID_FUNCTOR);

      assert.strictEqual(msg.id, 1234);
    });
  });

  describe('.payload', () => {
    it('should return the constructed payload', () => {
      const msg = new Message(123, 'target', VALID_FUNCTOR);

      assert.strictEqual(msg.payload, VALID_FUNCTOR);
    });
  });

  describe('.targetId', () => {
    it('should return the constructed target ID', () => {
      const msg = new Message(123, 'target-yep', VALID_FUNCTOR);

      assert.strictEqual(msg.targetId, 'target-yep');
    });
  });
});
