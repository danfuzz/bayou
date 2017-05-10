// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { before, describe, it } from 'mocha';

import { Message, Registry } from 'api-common';
import { Mocks } from 'testing-server';

before(() => {
  try {
    Registry.register(Mocks.apiObject().constructor);
  } catch (e) {
    // nothing to do here, the try/catch is just in case some other test
    // file has already registered the mock API object.
  }
});

describe('api-common/Message', () => {
  describe('constructor(id, target, action, name, args)', () => {
    it('should require integer ids >= 0', () => {
      assert.throws(() => new Message('this better not work!', 'foo', 'call', 'bar', []));
      assert.throws(() => new Message(3.7, 'target', 'call', 'method', []));
      assert.throws(() => new Message(true, 'target', 'call', 'method', []));
      assert.throws(() => new Message(null, 'target', 'call', 'method', []));
      assert.throws(() => new Message(undefined, 'target', 'call', 'method', []));
      assert.throws(() => new Message(-1, 'target', 'call', 'method', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'call', 'method', []));
      assert.doesNotThrow(() => new Message(37, 'target', 'call', 'method', []));
    });

    it('should require target to be a non-empty string', () => {
      assert.throws(() => new Message(37, 37, 'call', 'bar', []));
      assert.throws(() => new Message(37, false, 'call', 'bar', []));
      assert.throws(() => new Message(37, null, 'call', 'bar', []));
      assert.throws(() => new Message(37, undefined, 'call', 'bar', []));
      assert.throws(() => new Message(37, '', 'call', 'bar', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'call', 'method', []));
    });

    it("should require that action be 'call'", () => {
      assert.throws(() => new Message(0, 'target', false, 'method', []));
      assert.throws(() => new Message(0, 'target', 37, 'method', []));
      assert.throws(() => new Message(0, 'target', null, 'method', []));
      assert.throws(() => new Message(0, 'target', undefined, 'method', []));
      assert.throws(() => new Message(0, 'target', '', 'method', []));
      assert.throws(() => new Message(0, 'target', 'this better not work!', 'method', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'call', 'method', []));
    });

    it('should require name to be a non-empty string', () => {
      assert.throws(() => new Message(0, 'target', 'call', false, []));
      assert.throws(() => new Message(0, 'target', 'call', 37, []));
      assert.throws(() => new Message(0, 'target', 'call', null, []));
      assert.throws(() => new Message(0, 'target', 'call', undefined, []));
      assert.throws(() => new Message(0, 'target', 'call', '', []));

      assert.doesNotThrow(() => new Message(0, 'target', 'call', 'method', []));
    });

    it('should args to be an array', () => {
      assert.throws(() => new Message(0, 'target', 'call', 'method', false));
      assert.throws(() => new Message(0, 'target', 'call', 'method', 37));
      assert.throws(() => new Message(0, 'target', 'call', 'method', null));
      assert.throws(() => new Message(0, 'target', 'call', 'method', undefined));
      assert.throws(() => new Message(0, 'target', 'call', 'method', { }));

      assert.doesNotThrow(() => new Message(0, 'target', 'call', 'method', []));
    });

    it('should return a frozen object', () => {
      assert.throws(() => {
        const message = new Message(0, 'target', 'call', 'method', false);

        assert.isFrozen(message);
      });
    });
  });
});
