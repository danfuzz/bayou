// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Message } from 'api-common';
import { Functor } from 'util-common';

/** {Functor} Valid functor to use in tests. */
const VALID_FUNCTOR = new Functor('blort', 37, 914);

describe('api-common/Message', () => {
  describe('constructor()', () => {
    it('should require integer ids >= 0', () => {
      assert.throws(() => new Message('this better not work!', 'foo', VALID_FUNCTOR));
      assert.throws(() => new Message(3.7, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(true, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(null, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(undefined, 'target', VALID_FUNCTOR));
      assert.throws(() => new Message(-1, 'target', VALID_FUNCTOR));

      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
      assert.doesNotThrow(() => new Message(37, 'target', VALID_FUNCTOR));
    });

    it('should require target to be a non-empty string', () => {
      assert.throws(() => new Message(37, 37, VALID_FUNCTOR));
      assert.throws(() => new Message(37, false, VALID_FUNCTOR));
      assert.throws(() => new Message(37, null, VALID_FUNCTOR));
      assert.throws(() => new Message(37, undefined, VALID_FUNCTOR));
      assert.throws(() => new Message(37, '', VALID_FUNCTOR));

      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
    });

    it('should require a valid functor', () => {
      assert.throws(() => new Message(0, 'target', null));
      assert.throws(() => new Message(0, 'target', 'blort'));
      assert.throws(() => new Message(0, 'target', { name: 'x', args: [] }));

      assert.doesNotThrow(() => new Message(0, 'target', VALID_FUNCTOR));
    });

    it('should return a frozen object', () => {
      const message = new Message(0, 'target', VALID_FUNCTOR);
      assert.isFrozen(message);
    });
  });
});
