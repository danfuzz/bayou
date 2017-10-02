// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseSnapshot } from 'doc-common';

import MockChange from './MockChange';
import MockDelta from './MockDelta';

/**
 * Mock subclass of `BaseSnapshot` for testing.
 */
class MockSnapshot extends BaseSnapshot {
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  _impl_diffAsDelta(newerSnapshot) {
    return [MockDelta.makeOp('diff_delta'), newerSnapshot.contents.ops[0]];
  }

  static get _impl_changeClass() {
    return MockChange;
  }
}

/**
 * A second mock subclass of `BaseSnapshot`.
 */
class AnotherSnapshot extends BaseSnapshot {
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  static get _impl_changeClass() {
    return MockChange;
  }
}

describe('doc-common/BaseSnapshot', () => {
  describe('.EMPTY', () => {
    it('should be an empty instance', () => {
      const EMPTY = MockSnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.contents, MockDelta.EMPTY);
      assert.isFrozen(EMPTY);
    });
  });

  describe('constructor()', () => {
    it('should accept an array of ops for the contents', () => {
      function test(value) {
        new MockSnapshot(0, value);
      }

      test([]);
      test(MockDelta.VALID_OPS);
    });

    it('should accept valid revision numbers', () => {
      function test(value) {
        new MockSnapshot(value, MockDelta.EMPTY);
      }

      test(0);
      test(1);
      test(999999);
    });

    it('should accept a valid delta', () => {
      function test(ops) {
        const delta = new MockDelta(ops);
        new MockSnapshot(0, delta);
      }

      test([]);
      test(MockDelta.VALID_OPS);
    });

    it('should produce a frozen instance', () => {
      const snap = new MockSnapshot(0, MockDelta.VALID_OPS);
      assert.isFrozen(snap);
    });

    it('should reject an invalid array', () => {
      assert.throws(() => { new MockSnapshot(0, MockDelta.INVALID_OPS); });
      assert.throws(() => { new MockSnapshot(0, MockDelta.NOT_DOCUMENT_OPS); });
    });

    it('should reject a non-document delta', () => {
      // This is a valid delta for which `isDocument()` is `false`.
      const badDelta = new MockDelta(MockDelta.NOT_DOCUMENT_OPS);

      assert.throws(() => { new MockSnapshot(0, badDelta); });
    });

    it('should reject invalid revision numbers', () => {
      function test(value) {
        assert.throws(() => { new MockSnapshot(value, MockDelta.EMPTY); });
      }

      test(-1);
      test(1.5);
      test(null);
      test(false);
      test(undefined);
      test([]);
      test([789]);
      test({ a: 10 });
    });
  });

  describe('diff()', () => {
    it('should call through to the impl and wrap the result in a timeless authorless change', () => {
      const oldSnap = new MockSnapshot(10, []);
      const newSnap = new MockSnapshot(20, [MockDelta.makeOp('new_snap')]);
      const result  = oldSnap.diff(newSnap);

      assert.instanceOf(result, MockChange);
      assert.strictEqual(result.revNum, 20);
      assert.instanceOf(result.delta, MockDelta);
      assert.isNull(result.timestamp);
      assert.isNull(result.authorId);

      assert.deepEqual(result.delta.ops,
        [MockDelta.makeOp('diff_delta'), MockDelta.makeOp('new_snap')]);
    });

    it('should reject instances of the wrong snapshot class', () => {
      const oldSnap = new MockSnapshot(10, []);
      const newSnap = new AnotherSnapshot(20, []);

      assert.throws(() => { oldSnap.diff(newSnap); });
    });

    it('should reject non-snapshot arguments', () => {
      const oldSnap = new MockSnapshot(10, []);

      function test(v) {
        assert.throws(() => { oldSnap.diff(v); });
      }

      test(undefined);
      test(null);
      test(false);
      test('blort');
      test(['florp']);
      test({ x: 10 });
      test(new Map());
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      function test(...args) {
        const snap = new MockSnapshot(...args);
        assert.isTrue(snap.equals(snap), inspect(snap));
      }

      test(0,   []);
      test(0,   MockDelta.EMPTY);
      test(37,  []);
      test(37,  MockDelta.EMPTY);
      test(914, MockDelta.VALID_OPS);
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const snap1 = new MockSnapshot(...args);
        const snap2 = new MockSnapshot(...args);
        const label = inspect(snap1);
        assert.isTrue(snap1.equals(snap2), label);
        assert.isTrue(snap2.equals(snap1), label);
      }

      test(0,   []);
      test(0,   MockDelta.EMPTY);
      test(37,  []);
      test(37,  MockDelta.EMPTY);
      test(914, MockDelta.VALID_OPS);
    });

    it('should return `true` when equal property values are not also `===`', () => {
      // This validates that the base class calls `.equals()` on the delta.
      const snap1 = new MockSnapshot(37, MockDelta.VALID_OPS);
      const snap2 = new MockSnapshot(37, MockDelta.VALID_OPS);

      assert.isTrue(snap1.equals(snap2));
      assert.isTrue(snap2.equals(snap1));
    });

    it('should return `false` when `revNum`s differ', () => {
      const snap1 = new MockSnapshot(123, MockDelta.EMPTY);
      const snap2 = new MockSnapshot(456, MockDelta.EMPTY);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when deltas are not equal', () => {
      const snap1 = new MockSnapshot(123, [MockDelta.makeOp('x')]);
      const snap2 = new MockSnapshot(123, [MockDelta.makeOp('y')]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when passed a non-snapshot', () => {
      const snap = MockSnapshot.EMPTY;

      assert.isFalse(snap.equals(undefined));
      assert.isFalse(snap.equals(null));
      assert.isFalse(snap.equals(false));
      assert.isFalse(snap.equals(true));
      assert.isFalse(snap.equals(914));
      assert.isFalse(snap.equals(['not', 'a', 'snapshot']));
      assert.isFalse(snap.equals(new Map()));
    });
  });

  describe('withContents()', () => {
    it('should return `this` if the given `contents` is `===` to the snapshot\'s', () => {
      const snap = new MockSnapshot(123, MockDelta.EMPTY);

      assert.strictEqual(snap.withContents(MockDelta.EMPTY), snap);
    });

    it('should return an appropriately-constructed instance given a different `contents`', () => {
      const delta  = new MockDelta([MockDelta.makeOp('yo')]);
      const snap   = new MockSnapshot(123, [MockDelta.makeOp('hello')]);
      const result = snap.withContents(delta);

      assert.strictEqual(result.revNum,   123);
      assert.strictEqual(result.contents, delta);
    });

    it('should reject an invalid `contents`', () => {
      const snap = new MockSnapshot(123, []);

      assert.throws(() => snap.withContents('blortch'));
      assert.throws(() => snap.withContents(['array', 'is', 'too', 'long']));
    });
  });

  describe('withRevNum()', () => {
    it('should return `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new MockSnapshot(123, MockDelta.EMPTY);

      assert.strictEqual(snap.withRevNum(123), snap);
    });

    it('should return an appropriately-constructed instance given a different `revNum`', () => {
      const delta  = new MockDelta(MockDelta.VALID_OPS);
      const snap   = new MockSnapshot(123, delta);
      const result = snap.withRevNum(456);

      assert.strictEqual(result.revNum,   456);
      assert.strictEqual(result.contents, delta);
    });

    it('should reject an invalid `revNum`', () => {
      const snap = new MockSnapshot(123, []);

      assert.throws(() => snap.withRevNum('blortch'));
      assert.throws(() => snap.withRevNum(-1));
      assert.throws(() => snap.withRevNum(22.7));
    });
  });
});
