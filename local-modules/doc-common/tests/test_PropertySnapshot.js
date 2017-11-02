// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { PropertyChange, PropertyDelta, PropertyOp, PropertySnapshot } from 'doc-common';
import { DataUtil, Functor } from 'util-common';

describe('doc-common/PropertySnapshot', () => {
  describe('.EMPTY', () => {
    it('should be an empty instance', () => {
      const EMPTY = PropertySnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.size, 0);
      assert.isFrozen(EMPTY);
    });
  });

  describe('constructor()', () => {
    it('should accept an array of valid ops', () => {
      function test(value) {
        new PropertySnapshot(0, value);
      }

      test([]);
      test([PropertyOp.op_setProperty('x', 'y')]);
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_setProperty('z', 'pdq')
      ]);
    });

    it('should accept valid revision numbers', () => {
      function test(value) {
        new PropertySnapshot(value, PropertyDelta.EMPTY);
      }

      test(0);
      test(1);
      test(999999);
    });

    it('should accept a valid delta', () => {
      function test(ops) {
        const delta = new PropertyDelta(ops);
        new PropertySnapshot(0, delta);
      }

      test([]);
      test([PropertyOp.op_setProperty('x', 'y')]);
      test([PropertyOp.op_setProperty('x', 'y'), PropertyOp.op_setProperty('z', 'pdq')]);
    });

    it('should produce a frozen instance', () => {
      const snap = new PropertySnapshot(0, [PropertyOp.op_setProperty('x', 'y')]);
      assert.isFrozen(snap);
    });

    it('should reject an array that is not all valid ops', () => {
      function test(value) {
        assert.throws(() => { new PropertySnapshot(0, value); });
      }

      test([1]);
      test([
        'florp',
        PropertyOp.op_setProperty('x', 'y')
      ]);
      test([PropertyOp.op_deleteProperty('x')]); // Deletes aren't allowed.
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_deleteProperty('x') // Deletes aren't allowed.
      ]);
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_setProperty('x', 'z') // Duplicate names aren't allowed.
      ]);
    });

    it('should reject a delta with disallowed ops', () => {
      function test(ops) {
        const delta = new PropertyDelta(ops);
        assert.throws(() => { new PropertySnapshot(0, delta); });
      }

      // Deletes aren't allowed.
      test([PropertyOp.op_deleteProperty('x')]);
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_deleteProperty('x')]);

      // Duplicate names aren't allowed.
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_setProperty('x', 'z')
      ]);
    });

    it('should reject invalid revision numbers', () => {
      function test(value) {
        assert.throws(() => { new PropertySnapshot(value, PropertyDelta.EMPTY); });
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
    it('should indicate the count of bindings', () => {
      function test(ops) {
        const snap = new PropertySnapshot(1, ops);
        assert.strictEqual(snap.size, ops.length);
      }

      test([]);
      test([PropertyOp.op_setProperty('x', 'y')]);
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_setProperty('z', 'pdq')
      ]);
      test([
        PropertyOp.op_setProperty('x', 'y'),
        PropertyOp.op_setProperty('z', 'pdq'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);
    });
  });

  describe('compose()', () => {
    it('should produce an equal instance when passed an empty change with the same `revNum`', () => {
      let which = 0;
      function test(snap) {
        which++;
        const change = new PropertyChange(snap.revNum, PropertyDelta.EMPTY);
        const result = snap.compose(change);
        assert.deepEqual(result, snap, `#${which}`);
      }

      test(PropertySnapshot.EMPTY);

      test(new PropertySnapshot(123, PropertyDelta.EMPTY));
      test(new PropertySnapshot(0,   [PropertyOp.op_setProperty('foo', 'bar')]));
      test(new PropertySnapshot(37,  [PropertyOp.op_setProperty('foo', 'bar')]));
      test(new PropertySnapshot(37,
        [PropertyOp.op_setProperty('foo', 'bar'), PropertyOp.op_setProperty('baz', 914)]));
    });

    it('should update `revNum` given a change with a different `revNum`', () => {
      const snap     = new PropertySnapshot(123, PropertyDelta.EMPTY);
      const expected = new PropertySnapshot(456, PropertyDelta.EMPTY);
      const result   = snap.compose(new PropertyChange(456, PropertyDelta.EMPTY));

      assert.strictEqual(result.revNum, 456);
      assert.isTrue(result.equals(expected));
    });

    it('should add a new property given the appropriate op', () => {
      const op       = PropertyOp.op_setProperty('florp', 'like');
      const snap     = new PropertySnapshot(0, []);
      const expected = new PropertySnapshot(0, [op]);
      const change   = new PropertyChange(0, [op]);
      const result   = snap.compose(change);

      assert.strictEqual(result.get('florp'), op.props.property);
      assert.isTrue(result.equals(expected));
    });

    it('should update a pre-existing property given an appropriate op', () => {
      const op       = PropertyOp.op_setProperty('florp', 'like');
      const snap     = new PropertySnapshot(0, [PropertyOp.op_setProperty('florp', 'unlike')]);
      const expected = new PropertySnapshot(0, [op]);
      const change   = new PropertyChange(0, [op]);
      const result   = snap.compose(change);

      assert.strictEqual(result.get('florp'), op.props.property);
      assert.isTrue(result.equals(expected));
    });

    it('should remove a property given the appropriate op', () => {
      const snap   = new PropertySnapshot(0, [PropertyOp.op_setProperty('florp', 'like')]);
      const change = new PropertyChange(0, [PropertyOp.op_deleteProperty('florp')]);
      const result = snap.compose(change);

      assert.isFalse(result.has('florp'));
      assert.isTrue(result.equals(PropertySnapshot.EMPTY));
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const snap = new PropertySnapshot(914,
        [PropertyOp.op_setProperty('a', 10), PropertyOp.op_setProperty('b', 20)]);
      const result = snap.diff(snap);

      assert.instanceOf(result, PropertyChange);
      assert.strictEqual(result.revNum, 914);
      assert.deepEqual(result.delta, PropertyDelta.EMPTY);
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const snap1 = new PropertySnapshot(123, [PropertyOp.op_setProperty('a', 10)]);
      const snap2 = new PropertySnapshot(456, [PropertyOp.op_setProperty('a', 10)]);
      const result = snap1.diff(snap2);

      const composed = new PropertySnapshot(0, []).compose(result);
      const expected = new PropertySnapshot(456, PropertyDelta.EMPTY);
      assert.strictEqual(composed.revNum, 456);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a property removal if that in fact happens', () => {
      const snap1 = new PropertySnapshot(0, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot(0, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const result = snap1.diff(snap2);

      const composed = snap1.compose(result);
      assert.isTrue(composed.equals(snap2));
    });
  });

  describe('entries()', () => {
    it('should return an iterator', () => {
      const snap   = new PropertySnapshot(0, []);
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
          const property = op.props.property;
          expectMap.set(property.name, property);
        }

        const snap = new PropertySnapshot(1, ops);
        for (const [name, value] of snap.entries()) {
          assert.isTrue(expectMap.has(name));
          assert.strictEqual(value, expectMap.get(name));
          expectMap.delete(name);
        }

        assert.strictEqual(expectMap.size, 0, 'All properties accounted for.');
      }

      test([]);
      test([PropertyOp.op_setProperty('x', null)]);
      test([PropertyOp.op_setProperty('x', 10)]);
      test([PropertyOp.op_setProperty('x', 'florp')]);
      test([PropertyOp.op_setProperty('x', [1, 2, 3])]);
      test([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20)
      ]);
      test([
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30),
        PropertyOp.op_setProperty('d', 40),
        PropertyOp.op_setProperty('e', 50),
        PropertyOp.op_setProperty('f', 60),
        PropertyOp.op_setProperty('g', 70)
      ]);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      function test(...args) {
        const snap = new PropertySnapshot(...args);
        assert.isTrue(snap.equals(snap), inspect(snap));
      }

      test(0, []);
      test(0, PropertyDelta.EMPTY);
      test(37, []);
      test(37, PropertyDelta.EMPTY);
      test(914, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const snap1 = new PropertySnapshot(...args);
        const snap2 = new PropertySnapshot(...args);
        const label = inspect(snap1);
        assert.isTrue(snap1.equals(snap2), label);
        assert.isTrue(snap2.equals(snap1), label);
      }

      test(0, []);
      test(0, PropertyDelta.EMPTY);
      test(37, []);
      test(37, PropertyDelta.EMPTY);
      test(914, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
    });

    it('should return `true` when identical construction ops are passed in different orders', () => {
      const snap1 = new PropertySnapshot(321, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot(321, [
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('c', 30),
      ]);

      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `true` when equal property values are not also `===`', () => {
      const snap1 = new PropertySnapshot(37, [
        PropertyOp.op_setProperty('a', [1, 2]),
        PropertyOp.op_setProperty('b', { b: 20 }),
        PropertyOp.op_setProperty('c', new Functor('x', [1, 2, 3]))
      ]);
      const snap2 = new PropertySnapshot(37, [
        PropertyOp.op_setProperty('a', [1, 2]),
        PropertyOp.op_setProperty('b', { b: 20 }),
        PropertyOp.op_setProperty('c', new Functor('x', [1, 2, 3]))
      ]);

      assert.isTrue(snap1.equals(snap2));
      assert.isTrue(snap2.equals(snap1));
    });

    it('should return `false` when `revNum`s differ', () => {
      const snap1 = new PropertySnapshot(123, [PropertyOp.op_setProperty('a', 10)]);
      const snap2 = new PropertySnapshot(456, [PropertyOp.op_setProperty('a', 10)]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when a property value differs', () => {
      const snap1 = new PropertySnapshot(9, [
        PropertyOp.op_setProperty('a', 10),
        PropertyOp.op_setProperty('b', 20),
        PropertyOp.op_setProperty('c', 30)
      ]);
      const snap2 = new PropertySnapshot(9, [
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

  describe('get()', () => {
    it('should return the value associated with an existing property', () => {
      function test(name, value) {
        const op = PropertyOp.op_setProperty(name, value);
        const snap = new PropertySnapshot(1, [
          PropertyOp.op_setProperty('a', 1),
          PropertyOp.op_setProperty('b', 2),
          PropertyOp.op_setProperty('c', 3),
          op,
          PropertyOp.op_setProperty('X', 11),
          PropertyOp.op_setProperty('Y', 22),
          PropertyOp.op_setProperty('Z', 33)
        ]);

        assert.strictEqual(snap.get(name), op.props.property);
      }

      test('zilch', undefined);
      test('zilch', null);
      test('zilch', false);
      test('zilch', []);
      test('zilch', {});
      test('zilch', 0);

      test('foo',   'bar');
      test('florp', ['like']);
    });

    it('should always return a deep-frozen property value even when the constructor was passed an unfrozen value', () => {
      const value = [[['zorch']], ['splat'], 'foo'];
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', value)]);

      const result = snap.get('blort');
      assert.isTrue(DataUtil.isDeepFrozen(result.value));
      assert.deepEqual(result.value, value);
    });

    it('should throw an error when given a name that is not bound as a property', () => {
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.throws(() => { snap.get('x'); });
    });
  });

  describe('getOrNull()', () => {
    it('should return the value associated with an existing property', () => {
      function test(name, value) {
        const op = PropertyOp.op_setProperty(name, value);
        const snap = new PropertySnapshot(1, [
          PropertyOp.op_setProperty('a', 1),
          PropertyOp.op_setProperty('b', 2),
          PropertyOp.op_setProperty('c', 3),
          op,
          PropertyOp.op_setProperty('X', 11),
          PropertyOp.op_setProperty('Y', 22),
          PropertyOp.op_setProperty('Z', 33)
        ]);

        assert.strictEqual(snap.getOrNull(name), op.props.property);
      }

      test('zilch', undefined);
      test('zilch', null);
      test('zilch', false);
      test('zilch', []);
      test('zilch', {});
      test('zilch', 0);

      test('foo',   'bar');
      test('florp', ['like']);
    });

    it('should always return a deep-frozen property value even when the constructor was passed an unfrozen value', () => {
      const value = [[['zorch']], ['splat'], 'foo'];
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', value)]);

      const result = snap.getOrNull('blort');
      assert.isTrue(DataUtil.isDeepFrozen(result.value));
      assert.deepEqual(result.value, value);
    });

    it('should return `null` when given a name that is not bound as a property', () => {
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.isNull(snap.getOrNull('x'));
    });
  });

  describe('has()', () => {
    it('should return `true` for an existing property', () => {
      const snap = new PropertySnapshot(1, [
        PropertyOp.op_setProperty('blort',  'zorch'),
        PropertyOp.op_setProperty('florp',  'like'),
        PropertyOp.op_setProperty('zilch',  null),
        PropertyOp.op_setProperty('zip',    undefined),
        PropertyOp.op_setProperty('zither', false)
      ]);

      assert.isTrue(snap.has('blort'));
      assert.isTrue(snap.has('florp'));
      assert.isTrue(snap.has('zilch'));
      assert.isTrue(snap.has('zip'));
      assert.isTrue(snap.has('zither'));
    });

    it('should return `false` for a non-existent property', () => {
      const snap = new PropertySnapshot(1, [
        PropertyOp.op_setProperty('blort', 'zorch'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);

      assert.isFalse(snap.has('zorch'));
      assert.isFalse(snap.has('like'));
      assert.isFalse(snap.has('x'));
    });

    it('should throw an error when passed an argument that is not a valid name', () => {
      const snap = PropertySnapshot.EMPTY;
      function test(value) {
        assert.throws(() => { snap.has(value); });
      }

      // Not a string.
      test(undefined);
      test(null);
      test(123);
      test(Symbol('x'));
      test(['y']);

      // Not an identifier string.
      test('');
      test('1');
      test('foo#bar');
    });
  });

  describe('withContents()', () => {
    it('should return `this` if the given `contents` is `===` to the snapshot\'s', () => {
      const snap = new PropertySnapshot(123, PropertyDelta.EMPTY);

      assert.strictEqual(snap.withContents(PropertyDelta.EMPTY), snap);
    });

    it('should return an appropriately-constructed instance given a different `contents`', () => {
      const delta  = new PropertyDelta([PropertyOp.op_setProperty('blort', 'zorch')]);
      const snap   = new PropertySnapshot(123, []);
      const result = snap.withContents(delta);

      assert.strictEqual(result.revNum,   123);
      assert.strictEqual(result.contents, delta);
    });

    it('should reject an invalid `contents`', () => {
      const snap = new PropertySnapshot(123, []);

      assert.throws(() => snap.withContents('blortch'));
    });
  });

  describe('withProperty()', () => {
    it('should return `this` if the exact property is already in the snapshot', () => {
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.strictEqual(snap.withProperty('blort', 'zorch'), snap);
    });

    it('should return an appropriately-constructed instance given a new property', () => {
      const snap     = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', 'zorch')]);
      const expected = new PropertySnapshot(1, [
        PropertyOp.op_setProperty('blort', 'zorch'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);

      assert.isTrue(snap.withProperty('florp', 'like').equals(expected));
    });

    it('should return an appropriately-constructed instance given an updated property', () => {
      const snap     = new PropertySnapshot(2, [PropertyOp.op_setProperty('blort', 'zorch')]);
      const expected = new PropertySnapshot(2, [PropertyOp.op_setProperty('blort', 'like')]);

      assert.isTrue(snap.withProperty('blort', 'like').equals(expected));
    });
  });

  describe('withRevNum()', () => {
    it('should return `this` if the given `revNum` is the same as in the snapshot', () => {
      const snap = new PropertySnapshot(123, PropertyDelta.EMPTY);

      assert.strictEqual(snap.withRevNum(123), snap);
    });

    it('should return an appropriately-constructed instance given a different `revNum`', () => {
      const delta  = new PropertyDelta([PropertyOp.op_setProperty('blort', 'zorch')]);
      const snap   = new PropertySnapshot(123, delta);
      const result = snap.withRevNum(456);

      assert.strictEqual(result.revNum,   456);
      assert.strictEqual(result.contents, delta);
    });

    it('should reject an invalid `revNum`', () => {
      const snap = new PropertySnapshot(123, []);

      assert.throws(() => snap.withRevNum('blortch'));
    });
  });

  describe('withoutProperty()', () => {
    it('should return `this` if there is no matching property', () => {
      const snap = new PropertySnapshot(1, [PropertyOp.op_setProperty('blort', 'zorch')]);

      assert.strictEqual(snap.withoutProperty('x'), snap);
      assert.strictEqual(snap.withoutProperty('y'), snap);
    });

    it('should return an appropriately-constructed instance if there is a matching property', () => {
      const snap = new PropertySnapshot(2, [
        PropertyOp.op_setProperty('blort', 'zorch'),
        PropertyOp.op_setProperty('florp', 'like')
      ]);
      const expected = new PropertySnapshot(2, [
        PropertyOp.op_setProperty('florp', 'like')
      ]);

      assert.isTrue(snap.withoutProperty('blort').equals(expected));
    });
  });
});
