// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Message } from 'api-common';

describe('api-common/Message', () => {
  describe('constructor(id, target, action, name, args)', () => {
    it('should require integer ids >= 0', () => {
      assert.throws(() => new Message('this better not work!', 'foo', 'bar', []));
      assert.throws(() => new Message(3.7, 'target', 'method', []));
      assert.throws(() => new Message(true, 'target', 'method', []));
      assert.throws(() => new Message(null, 'target', 'method', []));
      assert.throws(() => new Message(undefined, 'target', 'method', []));
      assert.throws(() => new Message(-1, 'target', 'method', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'method', []));
      assert.doesNotThrow(() => new Message(37, 'target', 'method', []));
    });

    it('should require target to be a non-empty string', () => {
      assert.throws(() => new Message(37, 37, 'bar', []));
      assert.throws(() => new Message(37, false, 'bar', []));
      assert.throws(() => new Message(37, null, 'bar', []));
      assert.throws(() => new Message(37, undefined, 'bar', []));
      assert.throws(() => new Message(37, '', 'bar', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'method', []));
    });

    it('should require name to be a non-empty string', () => {
      assert.throws(() => new Message(0, 'target', false, []));
      assert.throws(() => new Message(0, 'target', 37, []));
      assert.throws(() => new Message(0, 'target', null, []));
      assert.throws(() => new Message(0, 'target', undefined, []));
      assert.throws(() => new Message(0, 'target', '', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'method', []));
    });

    it('should require args to be an array', () => {
      assert.throws(() => new Message(0, 'target', 'method', false));
      assert.throws(() => new Message(0, 'target', 'method', 37));
      assert.throws(() => new Message(0, 'target', 'method', null));
      assert.throws(() => new Message(0, 'target', 'method', undefined));
      assert.throws(() => new Message(0, 'target', 'method', { }));

      assert.doesNotThrow(() => new Message(0, 'target', 'method', []));
    });

    it('should return a frozen object', () => {
      const message = new Message(0, 'target', 'method', ['args']);
      assert.isFrozen(message);
    });
  });
});
