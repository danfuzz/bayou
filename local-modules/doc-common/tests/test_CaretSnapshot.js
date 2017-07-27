// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Caret, CaretDelta, CaretSnapshot } from 'doc-common';

const caret1 = new Caret('session-1', 1, 0,  '#111111');
const caret2 = new Caret('session-2', 2, 6,  '#222222');
const caret3 = new Caret('session-3', 3, 99, '#333333');

describe('doc-common/CaretSnapshot', () => {
  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap = new CaretSnapshot(123, 234, [caret1, caret2]);
      const result = snap.diff(snap);

      assert.instanceOf(result, CaretDelta);
      assert.strictEqual(result.revNum, snap.revNum);
      assert.deepEqual(result.ops, []);
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
