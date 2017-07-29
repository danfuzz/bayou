// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretDelta, CaretOp, CaretSnapshot } from 'doc-common';

const caret1 = new Caret('session-1', 1, 0,  '#111111');
const caret2 = new Caret('session-2', 2, 6,  '#222222');
const caret3 = new Caret('session-3', 3, 99, '#333333');

describe('doc-common/CaretSnapshot', () => {
  describe('compose()', () => {
    it('should produce an equal instance when passed an empty delta', () => {
      let which = 0;
      function test(snap) {
        which++;
        const result = snap.compose(CaretDelta.EMPTY);
        assert.deepEqual(result, snap, `#${which}`);
      }

      test(new CaretSnapshot(123, 456, []));
      test(new CaretSnapshot(0,   234, [caret1]));
      test(new CaretSnapshot(321, 0,   [caret1, caret2]));
      test(new CaretSnapshot(999, 888, [caret1, caret2, caret3]));
    });

    it('should update `docRevNum` given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, 2,   [caret1]);
      const expected = new CaretSnapshot(1, 999, [caret1]);
      const result   = snap.compose(new CaretDelta([CaretOp.op_updateDocRevNum(999)]));

      assert.isTrue(result.equals(expected));
    });

    it('should update `revNum` given the appropriate op', () => {
      const snap     = new CaretSnapshot(1,   2, [caret1, caret2]);
      const expected = new CaretSnapshot(999, 2, [caret1, caret2]);
      const result   = snap.compose(new CaretDelta([CaretOp.op_updateRevNum(999)]));

      assert.isTrue(result.equals(expected));
    });

    it('should add a default caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, 2, [caret1]);
      const expected = new CaretSnapshot(1, 2, [caret1, new Caret('florp')]);
      const result   = snap.compose(new CaretDelta([CaretOp.op_beginSession('florp')]));

      assert.isTrue(result.equals(expected));
    });

    it('should refuse to update a nonexistent caret', () => {
      const snap  = new CaretSnapshot(1, 2, [caret1]);
      const delta = new CaretDelta([CaretOp.op_updateField('florp', 'index', 1)]);

      assert.throws(() => { snap.compose(delta); });
    });

    it('should update a pre-existing caret given an appropriate op', () => {
      const c1       = new Caret('foo', 1, 2, '#333333');
      const c2       = new Caret('foo', 3, 2, '#333333');
      const snap     = new CaretSnapshot(1, 2, [caret1, c1]);
      const expected = new CaretSnapshot(1, 2, [caret1, c2]);
      const op       = CaretOp.op_updateField('foo', 'index', 3);
      const result   = snap.compose(new CaretDelta([op]));

      assert.isTrue(result.equals(expected));
    });

    it('should allow introduction of a new caret with value given the appropriate ops', () => {
      const snap     = new CaretSnapshot(1, 2, []);
      const expected = new CaretSnapshot(1, 2, [caret1]);

      const delta = new CaretDelta([
        CaretOp.op_beginSession(caret1.sessionId),
        ...(Caret.EMPTY.diffFields(caret1, caret1.sessionId).ops)]);

      const result = snap.compose(delta);

      assert.isTrue(result.equals(expected));
    });

    it('should remove a caret given the appropriate op', () => {
      const snap     = new CaretSnapshot(1, 2, [caret1, caret2]);
      const expected = new CaretSnapshot(1, 2, [caret2]);
      const result =
        snap.compose(new CaretDelta([CaretOp.op_endSession(caret1.sessionId)]));

      assert.isTrue(result.equals(expected));
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap = new CaretSnapshot(123, 234, [caret1, caret2]);
      const result = snap.diff(snap);

      assert.instanceOf(result, CaretDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should result in a `docRevNum` diff if that in fact changes', () => {
      const snap1 = new CaretSnapshot(1, 2, [caret1, caret2]);
      const snap2 = new CaretSnapshot(1, 9, [caret1, caret2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(0, 0, []).compose(result);
      const expected = new CaretSnapshot(0, 9, []);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const snap1 = new CaretSnapshot(1, 2, [caret1, caret2]);
      const snap2 = new CaretSnapshot(9, 2, [caret1, caret2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(0, 0, []).compose(result);
      const expected = new CaretSnapshot(9, 0, []);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret removal if that in fact happens', () => {
      const snap1 = new CaretSnapshot(1, 2, [caret1, caret2]);
      const snap2 = new CaretSnapshot(1, 2, [caret1]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(0, 0, [caret2, caret3]).compose(result);
      const expected = new CaretSnapshot(0, 0, [caret3]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret addition if that in fact happens', () => {
      const snap1 = new CaretSnapshot(1, 2, [caret1]);
      const snap2 = new CaretSnapshot(1, 2, [caret1, caret2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(0, 0, []).compose(result);
      const expected = new CaretSnapshot(0, 0, [caret2]);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a caret update if that in fact happens', () => {
      const c1 = new Caret('florp', 1, 3, '#444444');
      const c2 = new Caret('florp', 2, 4, '#555555');
      const c3 = new Caret('florp', 3, 5, '#666666');
      const snap1 = new CaretSnapshot(1, 2, [c1]);
      const snap2 = new CaretSnapshot(1, 2, [c2]);
      const result = snap1.diff(snap2);

      const composed = new CaretSnapshot(0, 0, [caret1, c3]).compose(result);
      const expected = new CaretSnapshot(0, 0, [caret1, c2]);
      assert.isTrue(composed.equals(expected));
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      let snap;

      snap = new CaretSnapshot(0, 1, []);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(12, 23, [caret1]);
      assert.isTrue(snap.equals(snap));

      snap = new CaretSnapshot(234, 345, [caret1, caret2]);
      assert.isTrue(snap.equals(snap));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(0, 1, []);
      snap2 = new CaretSnapshot(0, 1, []);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(12, 23, [caret1]);
      snap2 = new CaretSnapshot(12, 23, [caret1]);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new CaretSnapshot(234, 345, [caret1, caret2]);
      snap2 = new CaretSnapshot(234, 345, [caret1, caret2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when identical carets are passed in different orders', () => {
      const snap1 = new CaretSnapshot(37, 914, [caret1, caret2, caret3]);
      const snap2 = new CaretSnapshot(37, 914, [caret3, caret1, caret2]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when equal carets are not also `===`', () => {
      const c1a = new Caret('florp', 2, 3, '#444444');
      const c1b = new Caret('florp', 2, 3, '#444444');
      const c2a = new Caret('like',  3, 0, '#dbdbdb');
      const c2b = new Caret('like',  3, 0, '#dbdbdb');

      const snap1 = new CaretSnapshot(1, 2, [c1a, c2a]);
      const snap2 = new CaretSnapshot(1, 2, [c1b, c2b]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `false` when `revNum`s differ', () => {
      const snap1 = new CaretSnapshot(1, 20, [caret1, caret2, caret3]);
      const snap2 = new CaretSnapshot(2, 20, [caret1, caret2, caret3]);
      assert.isFalse(snap1.equals(snap2));
    });

    it('should return `false` when `docRevNum`s differ', () => {
      const snap1 = new CaretSnapshot(1, 20, [caret1, caret2, caret3]);
      const snap2 = new CaretSnapshot(1, 30, [caret1, caret2, caret3]);
      assert.isFalse(snap1.equals(snap2));
    });

    it('should return `false` when caret contents differ', () => {
      let snap1, snap2;

      snap1 = new CaretSnapshot(1, 1, [caret1]);
      snap2 = new CaretSnapshot(1, 1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, 1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, 1, [caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, 1, [caret3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, 1, [caret3, caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2]);
      snap2 = new CaretSnapshot(1, 1, [caret1, caret3]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, 1, []);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, 1, [caret1]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));

      snap1 = new CaretSnapshot(1, 1, [caret1, caret2, caret3]);
      snap2 = new CaretSnapshot(1, 1, [caret1, caret2]);
      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });
  });
});
