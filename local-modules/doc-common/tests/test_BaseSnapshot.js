// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseChange, BaseSnapshot } from 'doc-common';

import { MockChange, MockDelta, MockOp, MockSnapshot } from 'doc-common/mocks';

/**
 * A second mock subclass of `BaseChange`.
 */
class AnotherChange extends BaseChange {
  static get _impl_deltaClass() {
    return MockDelta;
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

  describe('compose()', () => {
    it('should call through to the impl and wrap the result in a new instance', () => {
      const snap   = new MockSnapshot(10, [new MockOp('some_op')]);
      const change = new MockChange(20, [new MockOp('change_op')]);
      const result = snap.compose(change);

      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 20);
      assert.instanceOf(result.contents, MockDelta);

      assert.deepEqual(result.contents.ops,
        [new MockOp('composed_doc'), new MockOp('change_op')]);
    });

    it('should return `this` given a same-`revNum` empty-`delta` change', () => {
      const snap   = new MockSnapshot(10, [new MockOp('some_op')]);
      const change = new MockChange(10, []);
      const result = snap.compose(change);

      assert.strictEqual(result, snap);
    });

    it('should reject instances of the wrong change class', () => {
      const snap   = new MockSnapshot(10, []);
      const change = new AnotherChange(0, []);

      assert.throws(() => { snap.compose(change); });
    });

    it('should reject non-change arguments', () => {
      const snap = new MockSnapshot(10, []);

      function test(v) {
        assert.throws(() => { snap.compose(v); });
      }

      test(undefined);
      test(null);
      test(false);
      test('blort');
      test([]);
      test(['florp']);
      test({ x: 10 });
      test(new Map());
      test(MockDelta.EMPTY);
      test(MockSnapshot.EMPTY);
    });
  });

  describe('composeAll()', () => {
    it('should call through to the impl and wrap the result in a new instance', () => {
      const snap    = new MockSnapshot(10, [new MockOp('some_op')]);
      const change1 = new MockChange(21, [new MockOp('change_op1')]);
      const change2 = new MockChange(22, [new MockOp('change_op2')]);
      const result = snap.composeAll([change1, change2]);

      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 22);
      assert.instanceOf(result.contents, MockDelta);

      assert.deepEqual(result.contents.ops,
        [new MockOp('composed_doc_'), new MockOp('change_op2')]);
    });

    it('should return `this` given same-`revNum` empty-`delta` changes', () => {
      const snap   = new MockSnapshot(10, [new MockOp('some_op')]);
      const change = new MockChange(10, []);
      const result = snap.composeAll([change, change, change, change]);

      assert.strictEqual(result, snap);
    });

    it('should reject instances of the wrong change class', () => {
      const snap   = new MockSnapshot(10, []);
      const change = new AnotherChange(0, []);

      assert.throws(() => { snap.composeAll([change]); });
    });

    it('should reject non-change array elements', () => {
      const snap = new MockSnapshot(10, []);

      function test(v) {
        assert.throws(() => { snap.compose([v]); });
      }

      test(undefined);
      test(null);
      test(false);
      test('blort');
      test([]);
      test(['florp']);
      test({ x: 10 });
      test(new Map());
      test(MockDelta.EMPTY);
      test(MockSnapshot.EMPTY);
    });

    it('should reject non-array arguments', () => {
      const snap   = new MockSnapshot(10, []);

      assert.throws(() => { snap.composeAll(123); });
    });
  });

  describe('diff()', () => {
    it('should call through to the impl and wrap the result in a timeless authorless change', () => {
      const oldSnap = new MockSnapshot(10, []);
      const newSnap = new MockSnapshot(20, [new MockOp('new_snap')]);
      const result  = oldSnap.diff(newSnap);

      assert.instanceOf(result, MockChange);
      assert.strictEqual(result.revNum, 20);
      assert.instanceOf(result.delta, MockDelta);
      assert.isNull(result.timestamp);
      assert.isNull(result.authorId);

      assert.deepEqual(result.delta.ops,
        [new MockOp('diff_delta'), new MockOp('new_snap')]);
    });

    it('should return an empty change when given an argument with identical contents', () => {
      function test(s1, s2) {
        const result = s1.diff(s2);

        assert.strictEqual(result.revNum, s2.revNum);
        assert.lengthOf(result.delta.ops, 0);
      }

      const snap1 = new MockSnapshot(10, [new MockOp('some_op')]);
      const snap2 = new MockSnapshot(20, [new MockOp('some_op')]);
      const snap3 = new MockSnapshot(30, snap2.contents);

      test(snap1, snap1);
      test(snap1, snap2);
      test(snap1, snap3);
      test(snap2, snap1);
      test(snap2, snap3);
      test(snap3, snap1);
      test(snap3, snap2);
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
      const snap1 = new MockSnapshot(123, [new MockOp('x')]);
      const snap2 = new MockSnapshot(123, [new MockOp('y')]);

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
      const delta  = new MockDelta([new MockOp('yo')]);
      const snap   = new MockSnapshot(123, [new MockOp('hello')]);
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
