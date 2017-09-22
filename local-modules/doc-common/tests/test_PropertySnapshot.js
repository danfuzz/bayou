// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { PropertyDelta, PropertyOp, PropertySnapshot } from 'doc-common';
import { Functor } from 'util-common';

describe('doc-common/PropertySnapshot', () => {
  describe('.EMPTY', () => {
    it('should be an empty instance', () => {
      const EMPTY = PropertySnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.properties.size, 0);
    });
  });

  describe('compose()', () => {
    it('should produce an equal instance when passed an empty delta', () => {
      let which = 0;
      function test(snap) {
        which++;
        const result = snap.compose(PropertyDelta.EMPTY);
        assert.deepEqual(result, snap, `#${which}`);
      }

      test(PropertySnapshot.EMPTY);

      test(new PropertySnapshot([PropertyOp.op_updateRevNum(123)]));
      test(new PropertySnapshot([PropertyOp.op_setProperty('foo', 'bar')]));

      test(new PropertySnapshot([
        PropertyOp.op_updateRevNum(123),
        PropertyOp.op_setProperty('foo', 'bar')
      ]));

      test(new PropertySnapshot([
        PropertyOp.op_updateRevNum(123),
        PropertyOp.op_setProperty('foo', 'bar'),
        PropertyOp.op_setProperty('baz', 914)
      ]));
    });

    it('should update `revNum` given the appropriate op', () => {
      const snap     = new PropertySnapshot([PropertyOp.op_updateRevNum(123)]);
      const expected = new PropertySnapshot([PropertyOp.op_updateRevNum(456)]);
      const result   = snap.compose(new PropertyDelta([PropertyOp.op_updateRevNum(456)]));

      assert.strictEqual(result.revNum, 456);
      assert.isTrue(result.equals(expected));
    });

    it('should add a new property given the appropriate op', () => {
      const op       = PropertyOp.op_setProperty('florp', 'like');
      const snap     = new PropertySnapshot([]);
      const expected = new PropertySnapshot([op]);
      const delta    = new PropertyDelta([op]);
      const result   = snap.compose(delta);

      assert.strictEqual(result.get('florp'), 'like');
      assert.isTrue(result.equals(expected));
    });

    it('should update a pre-existing property given an appropriate op', () => {
      const op       = PropertyOp.op_setProperty('florp', 'like');
      const snap     = new PropertySnapshot([PropertyOp.op_setProperty('florp', 'unlike')]);
      const expected = new PropertySnapshot([op]);
      const delta    = new PropertyDelta([op]);
      const result   = snap.compose(delta);

      assert.strictEqual(result.get('florp'), 'like');
      assert.isTrue(result.equals(expected));
    });

    it('should remove a property given the appropriate op', () => {
      const snap     = new PropertySnapshot([PropertyOp.op_setProperty('florp', 'like')]);
      const delta    = new PropertyDelta([PropertyOp.op_deleteProperty('florp')]);
      const result   = snap.compose(delta);

      assert.isFalse(result.has('florp'));
      assert.isTrue(result.equals(PropertySnapshot.EMPTY));
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap = new PropertySnapshot([
        PropertyOp.op_updateRevNum(123),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20)
      ]);
      const result = snap.diff(snap);

      assert.instanceOf(result, PropertyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(123),
        PropertyOp.op_setProperty('a', 10)
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(456),
        PropertyOp.op_setProperty('a', 10)
      ]);
      const result = snap1.diff(snap2);

      const composed = new PropertySnapshot([]).compose(result);
      const expected = new PropertySnapshot([PropertyOp.op_updateRevNum(456)]);
      assert.strictEqual(composed.revNum, 456);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a property removal if that in fact happens', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const result = snap1.diff(snap2);

      const composed = snap1.compose(result);
      assert.isTrue(composed.equals(snap2));
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      let snap;

      snap = PropertySnapshot.EMPTY;
      assert.isTrue(snap.equals(snap));

      snap = new PropertySnapshot([PropertyOp.op_updateRevNum(37)]);
      assert.isTrue(snap.equals(snap));

      snap = new PropertySnapshot([
        PropertyOp.op_updateRevNum(37),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      assert.isTrue(snap.equals(snap));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      let snap1, snap2;

      snap1 = PropertySnapshot.EMPTY;
      snap2 = new PropertySnapshot([]);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new PropertySnapshot([PropertyOp.op_updateRevNum(37)]);
      snap2 = new PropertySnapshot([PropertyOp.op_updateRevNum(37)]);
      assert.isTrue(snap1.equals(snap2));

      snap1 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(37),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      snap2 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(37),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when identical construction ops are passed in different orders', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(37),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('c', 30),
        PropertyOp.op_updateRevNum(37)
      ]);

      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when equal property values are not also `===`', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', [1, 2]),
        PropertyOp.op_setProperty('b', { b: 20 }),
        PropertyOp.op_setProperty('c', new Functor('x', [1, 2, 3]))
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', [1, 2]),
        PropertyOp.op_setProperty('b', { b: 20 }),
        PropertyOp.op_setProperty('c', new Functor('x', [1, 2, 3]))
      ]);

      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `false` when `revNum`s differ', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(37),
        PropertyOp.op_setProperty('a', 10)
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_updateRevNum(242),
        PropertyOp.op_setProperty('a', 10)
      ]);

      assert.isFalse(snap1.equals(snap2));
    });

    it('should return `false` when property values differ', () => {
      const snap1 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 22222),
        PropertyOp.op_setProperty('c', 30)
      ]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when passed a non-snapshot', () => {
      const snap = PropertySnapshot.EMPTY;

      assert.isFalse(snap.equals(undefined));
      assert.isFalse(snap.equals(null));
      assert.isFalse(snap.equals(false));
      assert.isFalse(snap.equals(true));
      assert.isFalse(snap.equals(914));
      assert.isFalse(snap.equals(['not', 'a', 'snapshot']));
      assert.isFalse(snap.equals(new Map()));
    });
  });

  describe('withProperty()', () => {
    it('should return `this` if the exact property is already in the snapshot', () => {
      const snap = new PropertySnapshot([PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.strictEqual(snap.withProperty('blort', 'zorch'), snap);
    });

    it('should return an appropriately-constructed instance given a new property', () => {
      const snap     = new PropertySnapshot([PropertyOp.op_setProperty('blort', 'zorch')]);
      const expected = new PropertySnapshot([
        PropertyOp.op_setProperty('blort', 'zorch'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);

      assert.isTrue(snap.withProperty('florp', 'like').equals(expected));
    });

    it('should return an appropriately-constructed instance given an updated property', () => {
      const snap     = new PropertySnapshot([PropertyOp.op_setProperty('blort', 'zorch')]);
      const expected = new PropertySnapshot([PropertyOp.op_setProperty('blort', 'like')]);

      assert.isTrue(snap.withProperty('blort', 'like').equals(expected));
    });
  });

  describe('withRevNum()', () => {
    it('should return `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new PropertySnapshot([PropertyOp.op_updateRevNum(123)]);

      assert.strictEqual(snap.withRevNum(123), snap);
    });

    it('should return an appropriately-constructed instance given a different `revNum`', () => {
      const snap     = new PropertySnapshot([
        PropertyOp.op_updateRevNum(123),
        PropertyOp.op_setProperty('blort', 'zorch')
      ]);
      const expected = new PropertySnapshot([
        PropertyOp.op_updateRevNum(456),
        PropertyOp.op_setProperty('blort', 'zorch')
      ]);

      assert.deepEqual(snap.withRevNum(456), expected);
    });
  });

  describe('withoutProperty()', () => {
    it('should return `this` if there is no matching property', () => {
      const snap = new PropertySnapshot([PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.strictEqual(snap.withoutProperty('x'), snap);
      assert.strictEqual(snap.withoutProperty('y'), snap);
    });

    it('should return an appropriately-constructed instance if there is a matching property', () => {
      const snap = new PropertySnapshot([
        PropertyOp.op_updateRevNum(90909),
        PropertyOp.op_setProperty('blort', 'zorch'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);
      const expected = new PropertySnapshot([
        PropertyOp.op_updateRevNum(90909),
        PropertyOp.op_setProperty('florp', 'like')
      ]);

      assert.isTrue(snap.withoutProperty('blort').equals(expected));
    });
  });
});
