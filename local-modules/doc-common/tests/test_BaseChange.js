// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';

import { BaseChange, Timestamp } from 'doc-common';
import { CommonBase } from 'util-common';

/**
 * Mock "delta" class for testing.
 */
class MockDelta extends CommonBase {
  static get EMPTY() {
    if (!this._EMPTY) {
      this._EMPTY = new MockDelta();
    }
    return this._EMPTY;
  }
}

/**
 * Subclass of `BaseChange` used to do the testing.
 */
class MockChange extends BaseChange {
  static get _impl_deltaClass() {
    return MockDelta;
  }
}

describe('doc-common/BaseChange', () => {
  describe('.FIRST', () => {
    const first = MockChange.FIRST;

    it('should be an instance of the subclass', () => {
      assert.instanceOf(first, MockChange);
    });

    it('should be a frozen object', () => {
      assert.isFrozen(first);
    });

    it('should have the expected properties', () => {
      assert.deepEqual(first.delta, MockDelta.EMPTY);
      assert.strictEqual(first.revNum, 0);
      assert.isNull(first.authorId);
      assert.isNull(first.timestamp);
    });
  });

  describe('constructor()', () => {
    it('should produce a frozen instance', () => {
      const result = new MockChange(0, MockDelta.EMPTY);
      assert.isFrozen(result);
    });

    it('should accept valid arguments, which should be reflected in the accessors', () => {
      function test(...args) {
        const [revNum, delta, timestamp = null, authorId = null] = args;
        const result = new MockChange(...args);
        assert.strictEqual(result.revNum, revNum);
        assert.strictEqual(result.delta, delta);
        assert.strictEqual(result.timestamp, timestamp);
        assert.strictEqual(result.authorId, authorId);
      }

      test(0,   MockDelta.EMPTY);
      test(123, MockDelta.EMPTY);
      test(0,   new MockDelta());
      test(909, new MockDelta(), null);
      test(909, new MockDelta(), Timestamp.now());
      test(242, MockDelta.EMPTY, null, null);
      test(242, MockDelta.EMPTY, null, 'florp9019');
    });

    it('should reject invalid arguments', () => {
      function test(...args) {
        assert.throws(() => new MockChange(...args));
      }

      // Invalid `revNum`.
      test(-1,    MockDelta.EMPTY);
      test(1.5,   MockDelta.EMPTY);
      test('1',   MockDelta.EMPTY);
      test([1],   MockDelta.EMPTY);
      test(null,  MockDelta.EMPTY);
      test(false, MockDelta.EMPTY);

      // Invalid 'delta'.
      test(0, null);
      test(0, undefined);
      test(0, false);
      test(0, new Map());
      test(0, { ops: [] });
      test(0, []);
      test(0, new Delta()); // Needs to be a `MockDelta`.

      // Invalid `timestamp`.
      test(0, MockDelta.EMPTY, false);
      test(0, MockDelta.EMPTY, 0);
      test(0, MockDelta.EMPTY, []);
      test(0, MockDelta.EMPTY, new Date());
      test(0, MockDelta.EMPTY, Date.now());

      // Invalid `authorId`.
      test(0, MockDelta.EMPTY, null, false);
      test(0, MockDelta.EMPTY, null, 123);
      test(0, MockDelta.EMPTY, null, [123]);
      test(0, MockDelta.EMPTY, null, new Map());
    });
  });
});
