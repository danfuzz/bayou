// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';

import { BaseChange, Timestamp } from 'doc-common';
import { CommonBase, Errors } from 'util-common';

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

  constructor(got = null) {
    super();

    if ((got !== null) && (got.length !== 3)) {
      throw Errors.bad_value(got, 'length 3 array');
    }

    this.got = got;
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

/**
 * Asserts that the given instance has fields that are `===` to the given
 * values.
 *
 * @param {BaseChange} change Change in question.
 * @param {Int} revNum Revision number.
 * @param {object} delta Delta.
 * @param {Timestamp} timestamp Timestamp.
 * @param {string} authorId Author ID.
 */
function assertFields(change, revNum, delta, timestamp = null, authorId = null) {
  assert.strictEqual(change.revNum,    revNum);
  assert.strictEqual(change.delta,     delta);
  assert.strictEqual(change.timestamp, timestamp);
  assert.strictEqual(change.authorId,  authorId);
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
        assertFields(new MockChange(...args), ...args);
      }

      test(0,   MockDelta.EMPTY);
      test(123, MockDelta.EMPTY);
      test(0,   new MockDelta());
      test(909, new MockDelta(), null);
      test(909, new MockDelta(), Timestamp.MIN_VALUE);
      test(909, new MockDelta(), Timestamp.MIN_VALUE, null);
      test(242, MockDelta.EMPTY, null,                null);
      test(242, MockDelta.EMPTY, null,                'florp9019');
      test(242, MockDelta.EMPTY, Timestamp.MAX_VALUE, 'florp9019');
    });

    it('should accept an array for the `delta`, which should get passed to the delta constructor', () => {
      const array  = ['valid', 'length 3', '(see the MockDelta constructor)'];
      const result = new MockChange(0, array);

      assert.strictEqual(result.delta.got, array);
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
      test(0, ['invalid']);
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

  describe('with*', () => {
    function test(methodName, args, argIndex, newValue) {
      const orig   = new MockChange(...args);
      const result = orig[methodName](newValue);

      args[argIndex] = newValue;
      assertFields(result, ...args);
    }

    describe('withAuthorId()', () => {
      it('should produce a new instance with the expected fields', () => {
        test('withAuthorId', [99, new MockDelta(), Timestamp.MIN_VALUE, 'florp'], 3, 'blort');
      });
    });

    describe('withDelta()', () => {
      it('should produce a new instance with the expected fields', () => {
        test('withDelta', [999, new MockDelta(), Timestamp.MAX_VALUE, 'like'], 1, new MockDelta());
      });
    });

    describe('withRevNum()', () => {
      it('should produce a new instance with the expected fields', () => {
        test('withRevNum', [9999, new MockDelta(), Timestamp.MIN_VALUE, 'zorch'], 0, 123);
      });
    });

    describe('withTimestamp()', () => {
      it('should produce a new instance with the expected fields', () => {
        test('withTimestamp', [99999, new MockDelta(), Timestamp.MIN_VALUE, 'zorch'], 2, Timestamp.MAX_VALUE);
      });
    });
  });
});
