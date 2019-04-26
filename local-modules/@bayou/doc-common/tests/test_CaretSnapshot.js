// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretChange, CaretDelta, CaretId, CaretOp, CaretSnapshot } from '@bayou/doc-common';

/**
 * Convenient caret constructor, which takes positional parameters.
 *
 * @param {string} id Caret ID.
 * @param {Int} index Start caret position.
 * @param {Int} length Selection length.
 * @param {string} color Highlight color.
 * @param {string} authorId Author ID.
 * @returns {Caret} Appropriately-constructed caret.
 */
function newCaret(id, index, length, color, authorId) {
  return new Caret(id, { index, length, color, authorId });
}

/**
 * Convenient `op_add` constructor, which takes positional parameters
 * for the caret fields.
 *
 * @param {string} id Caret ID.
 * @param {Int} index Start caret position.
 * @param {Int} length Selection length.
 * @param {string} color Highlight color.
 * @param {string} authorId Author ID.
 * @returns {Caret} Appropriately-constructed caret.
 */
function newCaretOp(id, index, length, color, authorId) {
  return CaretOp.op_add(newCaret(id, index, length, color, authorId));
}

const caret1 = newCaret('cr-11111', 1, 0,  '#111111', 'aa');
const caret2 = newCaret('cr-22222', 2, 6,  '#222222', 'bb');
const caret3 = newCaret('cr-33333', 3, 99, '#333333', 'cc');

const op1 = CaretOp.op_add(caret1);
const op2 = CaretOp.op_add(caret2);
const op3 = CaretOp.op_add(caret3);

describe('@bayou/doc-common/CaretSnapshot', () => {
  describe('.EMPTY', () => {
    it('is an empty instance', () => {
      const EMPTY = CaretSnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.size, 0);
      assert.isFrozen(EMPTY);
    });
  });

  describe('constructor()', () => {
    it('accepts an array of valid ops', () => {
      function test(value) {
        new CaretSnapshot(0, value);
      }

      test([]);
      test([op1]);
      test([op1, op2]);
      test([op1, op2, op3]);
    });

    it('accepts valid revision numbers', () => {
      function test(value) {
        new CaretSnapshot(value, CaretDelta.EMPTY);
      }

      test(0);
      test(1);
      test(999999);
    });

    it('accepts a valid delta', () => {
      function test(ops) {
        const delta = new CaretDelta(ops);
        new CaretSnapshot(0, delta);
      }

      test([]);
      test([op1]);
      test([op1, op2]);
      test([op1, op2, op3]);
    });

    it('produces a frozen instance', () => {
      const snap = new CaretSnapshot(0, [op1]);
      assert.isFrozen(snap);
    });

    it('rejects an array that is not all valid ops', () => {
      function test(value) {
        assert.throws(() => { new CaretSnapshot(0, value); });
      }

      test([1]);
      test(['florp', op1]);
      test([op1, 'florp', op2]);
      test([CaretOp.op_delete('cr-xxxxx')]); // `delete`s aren't allowed.
      test([CaretOp.op_setField('cr-xxxxx', 'revNum', 1)]); // Individual field sets aren't allowed.
      test([op1, op1]); // Duplicates aren't allowed.
    });

    it('rejects a delta with disallowed ops', () => {
      function test(ops) {
        const delta = new CaretDelta(ops);
        assert.throws(() => { new CaretSnapshot(0, delta); });
      }

      // `delete` ops aren't allowed.
      test([CaretOp.op_delete('cr-xxxxx')]);
      test([op1, CaretOp.op_delete('cr-xxxxx')]);
      test([op1, CaretOp.op_delete(caret1.id)]);

      // Individual field sets aren't allowed.
      test([CaretOp.op_setField('cr-xxxxx', 'revNum', 1)]);
      test([op1, CaretOp.op_setField('cr-xxxxx', 'revNum', 1)]);
      test([op1, CaretOp.op_setField(caret1.id, 'revNum', 1)]);

      // Duplicates aren't allowed.
      test([op1, op1]);
    });

    it('rejects invalid revision numbers', () => {
      function test(value) {
        assert.throws(() => { new CaretSnapshot(value, CaretDelta.EMPTY); });
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

  describe('.size', () => {
    it('should indicate the count of carets', () => {
      function test(ops) {
        const snap = new CaretSnapshot(1, ops);
        assert.strictEqual(snap.size, ops.length);
      }

      test([]);
      test([op1]);
      test([op1, op2]);
      test([op1, op2, op3]);
    });
  });

  describe('compose()', () => {
    it('produces an equal instance when passed an empty change with the same `revNum`', () => {
      let which = 0;
      function test(snap) {
        which++;
        const result = snap.compose(new CaretChange(snap.revNum, CaretDelta.EMPTY));
        assert.deepEqual(result, snap, `#${which}`);
      }

      test(new CaretSnapshot(123, []));
      test(new CaretSnapshot(0,   [op1]));
      test(new CaretSnapshot(321, [op1, op2]));
      test(new CaretSnapshot(999, [op1, op2, op3]));
    });

    it('updates `revNum` given a change with a different `revNum`', () => {
      const snap     = new CaretSnapshot(1,  [op1, op2]);
      const expected = new CaretSnapshot(999,[op1, op2]);
      const result   = snap.compose(new CaretChange(999, []));

      assert.isTrue(result.equals(expected));
    });

    it('should add a new caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, []);
      const expected = new CaretSnapshot(1, [op1]);
      const change   = new CaretChange(1, [CaretOp.op_add(caret1)]);
      const result   = snap.compose(change);

      assert.isTrue(result.equals(expected));
    });

    it('should refuse to update a nonexistent caret', () => {
      const snap   = new CaretSnapshot(1, [op1]);
      const change = new CaretChange(1, [CaretOp.op_setField('cr-florp', 'index', 1)]);

      assert.throws(() => { snap.compose(change); });
    });

    it('updates a pre-existing caret given an appropriate op', () => {
      const c1       = newCaretOp('cr-foooo', 1, 2, '#333333', 'dd');
      const c2       = newCaretOp('cr-foooo', 3, 2, '#333333', 'dd');
      const snap     = new CaretSnapshot(1, [op1, c1]);
      const expected = new CaretSnapshot(1, [op1, c2]);
      const op       = CaretOp.op_setField('cr-foooo', 'index', 3);
      const result   = snap.compose(new CaretChange(1, [op]));

      assert.isTrue(result.equals(expected));
    });

    it('should remove a caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, [op1, op2]);
      const expected = new CaretSnapshot(1, [op2]);
      const result   = snap.compose(new CaretChange(1, [CaretOp.op_delete(caret1.id)]));

      assert.isTrue(result.equals(expected));
    });
  });

  describe('diff()', () => {
    it('produces an empty diff when passed itself', () => {
      const snap   = new CaretSnapshot(123, [op1, op2]);
      const result = snap.diff(snap);

      assert.instanceOf(result, CaretChange);
      assert.strictEqual(result.revNum, 123);
      assert.deepEqual(result.delta, CaretDelta.EMPTY);
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const snap1  = new CaretSnapshot(1, [op1, op2]);
      const snap2  = new CaretSnapshot(9, [op1, op2]);
      const result = snap1.diff(snap2);

      assert.strictEqual(result.revNum, 9);
      assert.deepEqual(result.delta, CaretDelta.EMPTY);

      const composed = new CaretSnapshot(0, []).compose(result);
      const expected = new CaretSnapshot(9, []);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret removal if that in fact happens', () => {
      const snap1  = new CaretSnapshot(4, [op1, op2]);
      const snap2  = new CaretSnapshot(4, [op1]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(4, [op2, op3]).compose(result);
      const expected = new CaretSnapshot(4, [op3]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret addition if that in fact happens', () => {
      const snap1  = new CaretSnapshot(1, [op1]);
      const snap2  = new CaretSnapshot(1, [op1, op2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(1, []).compose(result);
      const expected = new CaretSnapshot(1, [op2]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret update if that in fact happens', () => {
      const c1     = newCaretOp('cr-florp', 1, 3, '#444444', 'ff');
      const c2     = newCaretOp('cr-florp', 2, 4, '#555555', 'gg');
      const c3     = newCaretOp('cr-florp', 3, 5, '#666666', 'hh');
      const snap1  = new CaretSnapshot(1, [c1]);
      const snap2  = new CaretSnapshot(1, [c2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(1, [op1, c3]).compose(result);
      const expected = new CaretSnapshot(1, [op1, c2]);
      assert.isTrue(composed.equals(expected));
    });
  });

  describe('entries()', () => {
    it('returns an iterator', () => {
      const snap   = new CaretSnapshot(0, []);
      const result = snap.entries();

      assert.isFunction(result.next);

      // Iterators are supposed to return themselves from `[Symbol.iterator]()`.
      assert.isFunction(result[Symbol.iterator]);
      assert.strictEqual(result[Symbol.iterator](), result);
    });

    it('should in fact iterate over the properties', () => {
      function test(ops) {
        // Expectations as a map of keys to values.
        const expectMap = new Map();
        for (const op of ops) {
          const caret = op.props.caret;
          expectMap.set(caret.id, caret);
        }

        const snap = new CaretSnapshot(1, ops);
        for (const [caretId, caret] of snap.entries()) {
          assert.strictEqual(caret, expectMap.get(caretId));
          expectMap.delete(caretId);
        }

        assert.strictEqual(expectMap.size, 0, 'All carets accounted for.');
      }

      test([]);
      test([op1]);
      test([op1, op2]);
      test([op1, op2, op3]);
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
      let snap;

      snap = new CaretSnapshot(0, []);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(12, [op1]);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(234, [op1, op2]);
      assert.isTrue(snap.equals(snap));
    });

    it('returns `true` when passed an identically-constructed value', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(0, []);
      snap2 = new CaretSnapshot(0, []);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(12, [op1]);
      snap2 = new CaretSnapshot(12, [op1]);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(234, [op1, op2]);
      snap2 = new CaretSnapshot(234, [op1, op2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('returns `true` when identical carets are passed in different orders', () => {
      const snap1 = new CaretSnapshot(37, [op1, op2, op3]);
      const snap2 = new CaretSnapshot(37, [op3, op1, op2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('returns `true` when equal carets are not also `===`', () => {
      const c1a = newCaretOp('cr-florp', 2, 3, '#444444', 'ab');
      const c1b = newCaretOp('cr-florp', 2, 3, '#444444', 'ab');
      const c2a = newCaretOp('cr-like0',  3, 0, '#dbdbdb', 'cd');
      const c2b = newCaretOp('cr-like0',  3, 0, '#dbdbdb', 'cd');

      const snap1 = new CaretSnapshot(1, [c1a, c2a]);
      const snap2 = new CaretSnapshot(1, [c1b, c2b]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('returns `false` when `revNum`s differ', () => {
      const snap1 = new CaretSnapshot(1, [op1, op2, op3]);
      const snap2 = new CaretSnapshot(2, [op1, op2, op3]);
      assert.isFalse(snap1.equals(snap2));
    });

    it('returns `false` when caret contents differ', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(1, [op1]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2]);
      snap2 = new CaretSnapshot(1, [op1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2]);
      snap2 = new CaretSnapshot(1, [op3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2]);
      snap2 = new CaretSnapshot(1, [op3, op1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2]);
      snap2 = new CaretSnapshot(1, [op1, op3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2, op3]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2, op3]);
      snap2 = new CaretSnapshot(1, [op1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [op1, op2, op3]);
      snap2 = new CaretSnapshot(1, [op1, op2]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('returns `false` when passed a non-snapshot', () => {
      const snap = new CaretSnapshot(1, [op1, op2, op3]);

      assert.isFalse(snap.equals(undefined));
      assert.isFalse(snap.equals(null));
      assert.isFalse(snap.equals(false));
      assert.isFalse(snap.equals(true));
      assert.isFalse(snap.equals(914));
      assert.isFalse(snap.equals(['not', 'a', 'snapshot']));
      assert.isFalse(snap.equals(new Map()));
    });
  });

  describe('get()', () => {
    it('returns the caret associated with an existing ID', () => {
      const snap = new CaretSnapshot(999, [op1, op2, op3]);

      assert.strictEqual(snap.get(caret1.id), caret1);
      assert.strictEqual(snap.get(caret2.id), caret2);
      assert.strictEqual(snap.get(caret3.id), caret3);
    });

    it('throws an error when given an ID that is not in the snapshot', () => {
      const snap = new CaretSnapshot(999, [op1, op3]);

      assert.throws(() => { snap.get(caret2.id); });
    });

    it('throws an error if given an invalid ID', () => {
      const snap = new CaretSnapshot(999, []);

      assert.throws(() => { snap.get(123); });
      assert.throws(() => { snap.get(['x']); });
      assert.throws(() => { snap.get(''); });
    });
  });

  describe('getOrNull()', () => {
    it('returns the caret associated with an existing ID', () => {
      const snap = new CaretSnapshot(999, [op1, op2, op3]);

      assert.strictEqual(snap.getOrNull(caret1.id), caret1);
      assert.strictEqual(snap.getOrNull(caret2.id), caret2);
      assert.strictEqual(snap.getOrNull(caret3.id), caret3);
    });

    it('returns `null` when given an ID that is not in the snapshot', () => {
      const snap = new CaretSnapshot(999, [op1, op3]);

      assert.isNull(snap.getOrNull(caret2.id));
    });

    it('throws an error if given an invalid ID', () => {
      const snap = new CaretSnapshot(999, []);

      assert.throws(() => { snap.getOrNull(123); });
      assert.throws(() => { snap.getOrNull(['x']); });
      assert.throws(() => { snap.getOrNull(''); });
    });
  });

  describe('has()', () => {
    it('returns `true` when given an ID for an existing caret', () => {
      const snap = new CaretSnapshot(999, [op1, op2, op3]);

      assert.isTrue(snap.has(caret1.id));
      assert.isTrue(snap.has(caret2.id));
      assert.isTrue(snap.has(caret3.id));
    });

    it('returns `false` when given an ID that is not in the snapshot', () => {
      const snap = new CaretSnapshot(999, [op1, op3]);

      assert.isFalse(snap.has(caret2.id));
    });

    it('throws an error if given an invalid ID', () => {
      const snap = new CaretSnapshot(999, []);

      assert.throws(() => { snap.has(123); });
      assert.throws(() => { snap.has(['x']); });
      assert.throws(() => { snap.has(''); });
    });
  });

  describe('randomUnusedId()', () => {
    it('returns a string for which `CaretId.isInstance()` is `true`', () => {
      const snap = new CaretSnapshot(999, [op1, op2, op3]);
      const id   = snap.randomUnusedId();

      assert.isTrue(CaretId.isInstance(id));
    });

    it('returns an ID that is not used', () => {
      // What we're doing here is mocking out `CaretSnapshot.has()` to lie about
      // the IDs in the instance N times, so that we can infer that the method
      // under test actually retries.
      const snap    = new CaretSnapshot(999, []);
      let   retries = 10;
      let   gotId   = null;

      const mocked = Object.create(snap);
      mocked.has = (id) => {
        if (retries === 0) {
          gotId = id;
          return false;
        } else {
          retries--;
          return true;
        }
      };

      const result = mocked.randomUnusedId();
      assert.strictEqual(result, gotId);
      assert.strictEqual(retries, 0);
    });
  });

  describe('withCaret()', () => {
    it('returns `this` if the exact caret is already in the snapshot', () => {
      const snap = new CaretSnapshot(1, [op1]);

      assert.strictEqual(snap.withCaret(caret1), snap);

      const cloneCaret = new Caret(caret1, {});
      assert.strictEqual(snap.withCaret(cloneCaret), snap);
    });

    it('returns an appropriately-constructed instance given a new caret', () => {
      const snap     = new CaretSnapshot(1, [op1]);
      const expected = new CaretSnapshot(1, [op1, op2]);

      assert.isTrue(snap.withCaret(caret2).equals(expected));
    });

    it('returns an appropriately-constructed instance given an updated caret', () => {
      const modCaret = new Caret(caret1, { index: 321 });
      const modOp    = CaretOp.op_add(modCaret);
      const snap     = new CaretSnapshot(1, [op1,   op2]);
      const expected = new CaretSnapshot(1, [modOp, op2]);

      assert.isTrue(snap.withCaret(modCaret).equals(expected));
    });
  });

  describe('withContents()', () => {
    it('returns `this` if the given `contents` is `===` to the snapshot\'s', () => {
      const snap = new CaretSnapshot(123, CaretDelta.EMPTY);

      assert.strictEqual(snap.withContents(CaretDelta.EMPTY), snap);
    });

    it('returns an appropriately-constructed instance given a different `contents`', () => {
      const delta  = new CaretDelta([op1, op2, op3]);
      const snap   = new CaretSnapshot(111, [op1]);
      const result = snap.withContents(delta);

      assert.strictEqual(result.revNum,   111);
      assert.strictEqual(result.contents, delta);
    });

    it('rejects an invalid `contents`', () => {
      const snap = new CaretSnapshot(123, []);

      assert.throws(() => snap.withContents('blortch'));
    });
  });

  describe('withRevNum()', () => {
    it('returns `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new CaretSnapshot(1, [op1]);

      assert.strictEqual(snap.withRevNum(1), snap);
    });

    it('returns an appropriately-constructed instance given a different `revNum`', () => {
      const delta  = new CaretDelta([op1, op2]);
      const snap   = new CaretSnapshot(1, delta);
      const result = snap.withRevNum(2);

      assert.strictEqual(result.revNum,   2);
      assert.strictEqual(result.contents, delta);
    });

    it('rejects an invalid `revNum`', () => {
      const snap = new CaretSnapshot(1, [op1, op2]);

      assert.throws(() => snap.withRevNum('blortch'));
    });
  });

  describe('withoutCaret()', () => {
    describe('valid `Caret` argument', () => {
      it('returns `this` if there is no matching caret', () => {
        const snap = new CaretSnapshot(1, [op1]);

        assert.strictEqual(snap.withoutCaret(caret2), snap);
        assert.strictEqual(snap.withoutCaret(caret3), snap);
      });

      it('returns an appropriately-constructed instance if there is a matching caret', () => {
        const snap     = new CaretSnapshot(1, [op1, op2]);
        const expected = new CaretSnapshot(1, [op2]);

        assert.isTrue(snap.withoutCaret(caret1).equals(expected));
      });

      it('should only pay attention to the ID of the given caret', () => {
        const snap     = new CaretSnapshot(1, [op1, op2]);
        const expected = new CaretSnapshot(1, [op2]);
        const modCaret = new Caret(caret1, { revNum: 999999, index: 99 });

        assert.isTrue(snap.withoutCaret(modCaret).equals(expected));
      });
    });

    describe('valid ID argument', () => {
      it('returns `this` if there is no matching caret', () => {
        const snap = new CaretSnapshot(1, [op1]);

        assert.strictEqual(snap.withoutCaret('cr-not00'), snap);
      });

      it('returns an appropriately-constructed instance if there is a matching caret', () => {
        const snap     = new CaretSnapshot(1, [op1, op2]);
        const expected = new CaretSnapshot(1, [op2]);

        assert.isTrue(snap.withoutCaret(caret1.id).equals(expected));
      });
    });

    describe('invalid argument', () => {
      it('rejects invalid ID strings', () => {
        const snap = new CaretSnapshot(1, [op1]);
        assert.throws(() => snap.withoutCaret(''));
        assert.throws(() => snap.withoutCaret('ZORCH_SPLAT'));
      });

      it('rejects arguments that are neither strings nor `Caret`s', () => {
        const snap = new CaretSnapshot(1, [op1]);
        assert.throws(() => snap.withoutCaret(undefined));
        assert.throws(() => snap.withoutCaret(null));
        assert.throws(() => snap.withoutCaret(123));
        assert.throws(() => snap.withoutCaret([]));
      });
    });
  });
});
