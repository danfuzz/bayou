// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretChange, CaretDelta, CaretOp, CaretSnapshot } from 'doc-common';

/**
 * Convenient caret constructor, which takes positional parameters.
 *
 * @param {string} sessionId Session ID.
 * @param {Int} index Start caret position.
 * @param {Int} length Selection length.
 * @param {string} color Highlight color.
 * @returns {Caret} Appropriately-constructed caret.
 */
function newCaret(sessionId, index, length, color) {
  return new Caret(sessionId, { index, length, color });
}

const caret1 = newCaret('session_1', 1, 0,  '#111111');
const caret2 = newCaret('session_2', 2, 6,  '#222222');
const caret3 = newCaret('session_3', 3, 99, '#333333');

describe('doc-common/CaretSnapshot', () => {
  describe('.EMPTY', () => {
    it('should be an empty instance', () => {
      const EMPTY = CaretSnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.deepEqual(EMPTY.carets, []);
    });
  });

  describe('caretForSession()', () => {
    it('should return the caret associated with an existing session', () => {
      const snap = new CaretSnapshot(999, [caret1, caret2, caret3]);

      assert.strictEqual(snap.caretForSession(caret1.sessionId), caret1);
      assert.strictEqual(snap.caretForSession(caret2.sessionId), caret2);
      assert.strictEqual(snap.caretForSession(caret3.sessionId), caret3);
    });

    it('should return `null` when given a session ID that is not in the snapshot', () => {
      const snap = new CaretSnapshot(999, [caret1, caret3]);

      assert.isNull(snap.caretForSession(caret2.sessionId));
    });

    it('should throw an error if given an invalid session ID', () => {
      const snap = new CaretSnapshot(999, []);

      assert.throws(() => { snap.caretForSession(123); });
      assert.throws(() => { snap.caretForSession(['x']); });
      assert.throws(() => { snap.caretForSession(''); });
    });
  });

  describe('compose()', () => {
    it('should produce an equal instance when passed an empty change with the same `revNum`', () => {
      let which = 0;
      function test(snap) {
        which++;
        const result = snap.compose(new CaretChange(snap.revNum, CaretDelta.EMPTY));
        assert.deepEqual(result, snap, `#${which}`);
      }

      test(new CaretSnapshot(123, []));
      test(new CaretSnapshot(0,   [caret1]));
      test(new CaretSnapshot(321, [caret1, caret2]));
      test(new CaretSnapshot(999, [caret1, caret2, caret3]));
    });

    it('should update `revNum` given a change with a different `revNum`', () => {
      const snap     = new CaretSnapshot(1,  [caret1, caret2]);
      const expected = new CaretSnapshot(999,[caret1, caret2]);
      const result   = snap.compose(new CaretChange(999, []));

      assert.isTrue(result.equals(expected));
    });

    it('should add a new caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, []);
      const expected = new CaretSnapshot(1, [caret1]);
      const change   = new CaretChange(1, [CaretOp.op_beginSession(caret1)]);
      const result   = snap.compose(change);

      assert.isTrue(result.equals(expected));
    });

    it('should refuse to update a nonexistent caret', () => {
      const snap  = new CaretSnapshot(1, [caret1]);
      const change = new CaretChange(1, [CaretOp.op_setField('florp', 'index', 1)]);

      assert.throws(() => { snap.compose(change); });
    });

    it('should update a pre-existing caret given an appropriate op', () => {
      const c1       = newCaret('foo', 1, 2, '#333333');
      const c2       = newCaret('foo', 3, 2, '#333333');
      const snap     = new CaretSnapshot(1, [caret1, c1]);
      const expected = new CaretSnapshot(1, [caret1, c2]);
      const op       = CaretOp.op_setField('foo', 'index', 3);
      const result   = snap.compose(new CaretChange(1, [op]));

      assert.isTrue(result.equals(expected));
    });

    it('should remove a caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, [caret1, caret2]);
      const expected = new CaretSnapshot(1, [caret2]);
      const result   = snap.compose(new CaretChange(1, [CaretOp.op_endSession(caret1.sessionId)]));

      assert.isTrue(result.equals(expected));
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap   = new CaretSnapshot(123, [caret1, caret2]);
      const result = snap.diff(snap);

      assert.instanceOf(result, CaretChange);
      assert.strictEqual(result.revNum, 123);
      assert.deepEqual(result.delta, CaretDelta.EMPTY);
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const snap1  = new CaretSnapshot(1, [caret1, caret2]);
      const snap2  = new CaretSnapshot(9, [caret1, caret2]);
      const result = snap1.diff(snap2);

      assert.strictEqual(result.revNum, 9);
      assert.deepEqual(result.delta, CaretDelta.EMPTY);

      const composed = new CaretSnapshot(0, []).compose(result);
      const expected = new CaretSnapshot(9, []);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret removal if that in fact happens', () => {
      const snap1  = new CaretSnapshot(4, [caret1, caret2]);
      const snap2  = new CaretSnapshot(4, [caret1]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(4, [caret2, caret3]).compose(result);
      const expected = new CaretSnapshot(4, [caret3]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret addition if that in fact happens', () => {
      const snap1  = new CaretSnapshot(1, [caret1]);
      const snap2  = new CaretSnapshot(1, [caret1, caret2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(1, []).compose(result);
      const expected = new CaretSnapshot(1, [caret2]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret update if that in fact happens', () => {
      const c1     = newCaret('florp', 1, 3, '#444444');
      const c2     = newCaret('florp', 2, 4, '#555555');
      const c3     = newCaret('florp', 3, 5, '#666666');
      const snap1  = new CaretSnapshot(1, [c1]);
      const snap2  = new CaretSnapshot(1, [c2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(1, [caret1, c3]).compose(result);
      const expected = new CaretSnapshot(1, [caret1, c2]);
      assert.isTrue(composed.equals(expected));
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      let snap;

      snap = new CaretSnapshot(0, []);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(12, [caret1]);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(234, [caret1, caret2]);
      assert.isTrue(snap.equals(snap));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(0, []);
      snap2 = new CaretSnapshot(0, []);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(12, [caret1]);
      snap2 = new CaretSnapshot(12, [caret1]);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(234, [caret1, caret2]);
      snap2 = new CaretSnapshot(234, [caret1, caret2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when identical carets are passed in different orders', () => {
      const snap1 = new CaretSnapshot(37, [caret1, caret2, caret3]);
      const snap2 = new CaretSnapshot(37, [caret3, caret1, caret2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when equal carets are not also `===`', () => {
      const c1a = newCaret('florp', 2, 3, '#444444');
      const c1b = newCaret('florp', 2, 3, '#444444');
      const c2a = newCaret('like',  3, 0, '#dbdbdb');
      const c2b = newCaret('like',  3, 0, '#dbdbdb');

      const snap1 = new CaretSnapshot(1, [c1a, c2a]);
      const snap2 = new CaretSnapshot(1, [c1b, c2b]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `false` when `revNum`s differ', () => {
      const snap1 = new CaretSnapshot(1, [caret1, caret2, caret3]);
      const snap2 = new CaretSnapshot(2, [caret1, caret2, caret3]);
      assert.isFalse(snap1.equals(snap2));
    });

    it('should return `false` when caret contents differ', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(1, [caret1]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, [caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, [caret3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, [caret3, caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, [caret1, caret3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, [caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, [caret1, caret2]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when passed a non-snapshot', () => {
      const snap = new CaretSnapshot(1, [caret1, caret2, caret3]);

      assert.isFalse(snap.equals(undefined));
      assert.isFalse(snap.equals(null));
      assert.isFalse(snap.equals(false));
      assert.isFalse(snap.equals(true));
      assert.isFalse(snap.equals(914));
      assert.isFalse(snap.equals(['not', 'a', 'snapshot']));
      assert.isFalse(snap.equals(new Map()));
    });
  });

  describe('hasSession()', () => {
    it('should return `true` when given a session ID for an existing session', () => {
      const snap = new CaretSnapshot(999, [caret1, caret2, caret3]);

      assert.isTrue(snap.hasSession(caret1.sessionId));
      assert.isTrue(snap.hasSession(caret2.sessionId));
      assert.isTrue(snap.hasSession(caret3.sessionId));
    });

    it('should return `false` when given a session ID that is not in the snapshot', () => {
      const snap = new CaretSnapshot(999, [caret1, caret3]);

      assert.isFalse(snap.hasSession(caret2.sessionId));
    });

    it('should throw an error if given an invalid session ID', () => {
      const snap = new CaretSnapshot(999, []);

      assert.throws(() => { snap.hasSession(123); });
      assert.throws(() => { snap.hasSession(['x']); });
      assert.throws(() => { snap.hasSession(''); });
    });
  });

  describe('withCaret()', () => {
    it('should return `this` if the exact caret is already in the snapshot', () => {
      const snap = new CaretSnapshot(1, [caret1]);

      assert.strictEqual(snap.withCaret(caret1), snap);

      const cloneCaret = new Caret(caret1, {});
      assert.strictEqual(snap.withCaret(cloneCaret), snap);
    });

    it('should return an appropriately-constructed instance given a new caret', () => {
      const snap =     new CaretSnapshot(1, [caret1]);
      const expected = new CaretSnapshot(1, [caret1, caret2]);

      assert.isTrue(snap.withCaret(caret2).equals(expected));
    });

    it('should return an appropriately-constructed instance given an updated caret', () => {
      const modCaret = new Caret(caret1, { index: 321 });
      const snap =     new CaretSnapshot(1, [caret1,   caret2]);
      const expected = new CaretSnapshot(1, [modCaret, caret2]);

      assert.isTrue(snap.withCaret(modCaret).equals(expected));
    });
  });

  describe('withRevNum()', () => {
    it('should return `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new CaretSnapshot(1, [caret1]);

      assert.strictEqual(snap.withRevNum(1), snap);
    });

    it('should return an appropriately-constructed instance given a different `revNum`', () => {
      const snap =     new CaretSnapshot(1, [caret1, caret2]);
      const expected = new CaretSnapshot(2, [caret1, caret2]);

      assert.isTrue(snap.withRevNum(2).equals(expected));
    });
  });

  describe('withoutCaret()', () => {
    it('should return `this` if there is no matching session', () => {
      const snap = new CaretSnapshot(1, [caret1]);

      assert.strictEqual(snap.withoutCaret(caret2), snap);
      assert.strictEqual(snap.withoutCaret(caret3), snap);
    });

    it('should return an appropriately-constructed instance if there is a matching session', () => {
      const snap =     new CaretSnapshot(1, [caret1, caret2]);
      const expected = new CaretSnapshot(1, [caret2]);

      assert.isTrue(snap.withoutCaret(caret1).equals(expected));
    });

    it('should only pay attention to the session ID of the given caret', () => {
      const snap =     new CaretSnapshot(1, [caret1, caret2]);
      const expected = new CaretSnapshot(1, [caret2]);
      const modCaret = new Caret(caret1, { revNum: 999999, index: 99 });

      assert.isTrue(snap.withoutCaret(modCaret).equals(expected));
    });
  });

  describe('withoutSession()', () => {
    it('should return `this` if there is no matching session', () => {
      const snap = new CaretSnapshot(1, [caret1]);

      assert.strictEqual(snap.withoutSession('blort_is_not_a_session'), snap);
    });

    it('should return an appropriately-constructed instance if there is a matching session', () => {
      const snap =     new CaretSnapshot(1, [caret1, caret2]);
      const expected = new CaretSnapshot(1, [caret2]);

      assert.isTrue(snap.withoutSession(caret1.sessionId).equals(expected));
    });
  });
});
