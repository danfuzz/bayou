// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseChange, BaseSnapshot } from '@bayou/ot-common';

import { MockChange, MockDelta, MockOp, MockSnapshot } from '@bayou/ot-common/mocks';

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

describe('@bayou/ot-common/BaseSnapshot', () => {
  describe('.EMPTY', () => {
    it('is an empty instance', () => {
      const EMPTY = MockSnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.contents, MockDelta.EMPTY);
      assert.isFrozen(EMPTY);
    });
  });

  describe('constructor()', () => {
    it('accepts an array of ops for the contents', () => {
      function test(value) {
        new MockSnapshot(0, value);
      }

      test([]);
      test(MockDelta.VALID_OPS);
    });

    it('accepts valid revision numbers', () => {
      function test(value) {
        new MockSnapshot(value, MockDelta.EMPTY);
      }

      test(0);
      test(1);
      test(999999);
    });

    it('accepts a valid delta', () => {
      function test(ops) {
        const delta = new MockDelta(ops);
        new MockSnapshot(0, delta);
      }

      test([]);
      test(MockDelta.VALID_OPS);
    });

    it('produces a frozen instance', () => {
      const snap = new MockSnapshot(0, MockDelta.VALID_OPS);
      assert.isFrozen(snap);
    });

    it('rejects an invalid array', () => {
      assert.throws(() => { new MockSnapshot(0, MockDelta.INVALID_OPS); });
      assert.throws(() => { new MockSnapshot(0, MockDelta.NOT_DOCUMENT_OPS); });
    });

    it('rejects a non-document delta', () => {
      // This is a valid delta for which `isDocument()` is `false`.
      const badDelta = new MockDelta(MockDelta.NOT_DOCUMENT_OPS);

      assert.throws(() => { new MockSnapshot(0, badDelta); });
    });

    it('rejects invalid revision numbers', () => {
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
    it('calls through to the delta and wraps the result in a new instance', () => {
      const snap   = new MockSnapshot(10, [new MockOp('x')]);
      const change = new MockChange(20, [new MockOp('y')]);
      const result = snap.compose(change);

      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 20);
      assert.instanceOf(result.contents, MockDelta);

      assert.deepEqual(result.contents.ops,
        [new MockOp('composedDoc', 1), new MockOp('y')]);
    });

    it('returns `this` given a same-`revNum` empty-`delta` change', () => {
      const snap   = new MockSnapshot(10, [new MockOp('x')]);
      const change = new MockChange(10, []);
      const result = snap.compose(change);

      assert.strictEqual(result, snap);
    });

    it('rejects instances of the wrong change class', () => {
      const snap   = new MockSnapshot(10, []);
      const change = new AnotherChange(0, []);

      assert.throws(() => { snap.compose(change); });
    });

    it('rejects non-change arguments', () => {
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
    it('calls through to the delta and wraps the result in a new instance', async () => {
      const snap    = new MockSnapshot(10, [new MockOp('x')]);
      const change1 = new MockChange(21, [new MockOp('y')]);
      const change2 = new MockChange(22, [new MockOp('z')]);
      const result  = await snap.composeAll([change1, change2]);

      assert.instanceOf(result, MockSnapshot);
      assert.strictEqual(result.revNum, 22);
      assert.instanceOf(result.contents, MockDelta);

      assert.deepEqual(result.contents.ops,
        [new MockOp('composedDoc', 2), new MockOp('z')]);
    });

    it('calls the `yieldFunction` the appropriate number of times and with the expected arguments', async () => {
      const snap       = new MockSnapshot(10, [new MockOp('x')]);
      const allChanges = [];

      for (let i = 0; i < 100; i++) {
        allChanges.push(new MockChange(i + 100, [new MockOp('yes', i), new MockOp('x', i)]));
      }

      async function test(max, total = allChanges.length) {
        const label     = `max ${max}, total ${total}`;
        const asserts   = [];
        const changes   = allChanges.slice(0, total);
        let callCount   = 0;
        let expectStart = 0;

        const yfunc = async (start, end) => {
          callCount++;

          // Required so as to capture this iteration's values for use in the
          // closure below.
          const cc = callCount;
          const s  = expectStart;

          asserts.push(() => {
            const e = Math.min(s + max, changes.length);
            assert.strictEqual(start, s, `${label}, count ${cc}`);
            assert.strictEqual(end,   e, `${label}, count ${cc}`);
          });

          expectStart += max;
        };

        const result = await snap.composeAll(changes, max, yfunc);
        assert.strictEqual(callCount, Math.ceil(changes.length / max), label);

        const lastChange = changes[changes.length - 1];
        const expectOps  = [new MockOp('composedDoc', total), ...lastChange.delta.ops];
        assert.deepEqual(result, new MockSnapshot(lastChange.revNum, expectOps), label);

        // What's going on here: We don't want to throw assertion errors inside
        // the middle of the call to `composeAll()`, so we build up an array of
        // assertion closures as we go, and run through them all here, after the
        // call to the method under test is complete.
        for (const a of asserts) {
          a();
        }
      }

      await test(1);
      await test(1, 1);
      await test(1, 2);
      await test(1, 17);
      await test(1, 90);
      await test(2);
      await test(2, 1);
      await test(2, 2);
      await test(2, 5);
      await test(2, 80);
      await test(2, 99);
      await test(10);
      await test(10, 1);
      await test(10, 9);
      await test(10, 95);
      await test(31);
      await test(31, 25);
      await test(67);
      await test(67, 98);
      await test(100);
      await test(100, 52);
    });

    it('rejects instances of the wrong change class', async () => {
      const snap = new MockSnapshot(10, []);
      const good = new MockChange(0, []);
      const bad  = new AnotherChange(0, []);

      await assert.isRejected(snap.composeAll([bad]), /badValue/);
      await assert.isRejected(snap.composeAll([bad, good]), /badValue/);
      await assert.isRejected(snap.composeAll([good, bad]), /badValue/);
    });

    it('rejects non-change array elements', async () => {
      const snap   = new MockSnapshot(10, []);
      const change = new MockChange(10, []);

      async function test(v) {
        await assert.isRejected(snap.composeAll([v]), /badValue/);
        await assert.isRejected(snap.composeAll([v, change]), /badValue/);
        await assert.isRejected(snap.composeAll([change, v]), /badValue/);
      }

      await test(undefined);
      await test(null);
      await test(false);
      await test(123);
      await test('blort');
      await test([]);
      await test(['florp']);
      await test({ x: 10 });
      await test(new Map());
      await test(MockDelta.EMPTY);
      await test(MockSnapshot.EMPTY);
    });

    it('rejects non-array arguments', async () => {
      const snap = new MockSnapshot(10, []);

      async function test(v) {
        await assert.isRejected(snap.composeAll(v), /badValue/);
      }

      await test(undefined);
      await test(null);
      await test(false);
      await test(123);
      await test('blort');
      await test({ x: 10 });
      await test(new Map());
      await test(MockDelta.EMPTY);
      await test(MockSnapshot.EMPTY);
    });
  });

  describe('diff()', () => {
    it('calls through to the impl and wraps the result in a timeless authorless change', () => {
      const oldSnap = new MockSnapshot(10, []);
      const newSnap = new MockSnapshot(20, [new MockOp('x')]);
      const result  = oldSnap.diff(newSnap);

      assert.instanceOf(result, MockChange);
      assert.strictEqual(result.revNum, 20);
      assert.instanceOf(result.delta, MockDelta);
      assert.isNull(result.timestamp);
      assert.isNull(result.authorId);

      assert.deepEqual(result.delta.ops,
        [new MockOp('diffDelta'), new MockOp('x')]);
    });

    it('returns an empty change when given an argument with identical contents', () => {
      function test(s1, s2) {
        const result = s1.diff(s2);

        assert.strictEqual(result.revNum, s2.revNum);
        assert.lengthOf(result.delta.ops, 0);
      }

      const snap1 = new MockSnapshot(10, [new MockOp('x')]);
      const snap2 = new MockSnapshot(20, [new MockOp('x')]);
      const snap3 = new MockSnapshot(30, snap2.contents);

      test(snap1, snap1);
      test(snap1, snap2);
      test(snap1, snap3);
      test(snap2, snap1);
      test(snap2, snap3);
      test(snap3, snap1);
      test(snap3, snap2);
    });

    it('rejects instances of the wrong snapshot class', () => {
      const oldSnap = new MockSnapshot(10, []);
      const newSnap = new AnotherSnapshot(20, []);

      assert.throws(() => { oldSnap.diff(newSnap); });
    });

    it('rejects non-snapshot arguments', () => {
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
    it('returns `true` when passed itself', () => {
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

    it('returns `true` when passed an identically-constructed value', () => {
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

    it('returns `true` when equal property values are not also `===`', () => {
      // This validates that the base class calls `.equals()` on the delta.
      const snap1 = new MockSnapshot(37, MockDelta.VALID_OPS);
      const snap2 = new MockSnapshot(37, MockDelta.VALID_OPS);

      assert.isTrue(snap1.equals(snap2));
      assert.isTrue(snap2.equals(snap1));
    });

    it('returns `false` when `revNum`s differ', () => {
      const snap1 = new MockSnapshot(123, MockDelta.EMPTY);
      const snap2 = new MockSnapshot(456, MockDelta.EMPTY);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('returns `false` when deltas are not equal', () => {
      const snap1 = new MockSnapshot(123, [new MockOp('x')]);
      const snap2 = new MockSnapshot(123, [new MockOp('y')]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('returns `false` when passed a non-snapshot', () => {
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
    it('returns `this` if the given `contents` is `===` to the snapshot\'s', () => {
      const snap = new MockSnapshot(123, MockDelta.EMPTY);

      assert.strictEqual(snap.withContents(MockDelta.EMPTY), snap);
    });

    it('returns an appropriately-constructed instance given a different `contents`', () => {
      const delta  = new MockDelta([new MockOp('x')]);
      const snap   = new MockSnapshot(123, [new MockOp('y')]);
      const result = snap.withContents(delta);

      assert.strictEqual(result.revNum,   123);
      assert.strictEqual(result.contents, delta);
    });

    it('rejects an invalid `contents`', () => {
      const snap = new MockSnapshot(123, []);

      assert.throws(() => snap.withContents('blortch'));
      assert.throws(() => snap.withContents(['array', 'is', 'too', 'long']));
    });
  });

  describe('withRevNum()', () => {
    it('returns `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new MockSnapshot(123, MockDelta.EMPTY);

      assert.strictEqual(snap.withRevNum(123), snap);
    });

    it('returns an appropriately-constructed instance given a different `revNum`', () => {
      const delta  = new MockDelta(MockDelta.VALID_OPS);
      const snap   = new MockSnapshot(123, delta);
      const result = snap.withRevNum(456);

      assert.strictEqual(result.revNum,   456);
      assert.strictEqual(result.contents, delta);
    });

    it('rejects an invalid `revNum`', () => {
      const snap = new MockSnapshot(123, []);

      assert.throws(() => snap.withRevNum('blortch'));
      assert.throws(() => snap.withRevNum(-1));
      assert.throws(() => snap.withRevNum(22.7));
    });
  });
});
