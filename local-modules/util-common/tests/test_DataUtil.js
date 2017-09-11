// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DataUtil } from 'util-common';

describe('util-common/DataUtil', () => {
  describe('deepFreeze()', () => {
    it('should return the given value if it is a primitive', () => {
      function test(value) {
        const popsicle = DataUtil.deepFreeze(value);
        assert.strictEqual(popsicle, value);
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(37);
      test('a string');
      test(Symbol('foo'));
    });

    it('should return the provided value if it is already deep-frozen', () => {
      function test(value) {
        const popsicle = DataUtil.deepFreeze(value);
        const deepPopsicle = DataUtil.deepFreeze(popsicle);
        assert.strictEqual(deepPopsicle, popsicle, 'Frozen strict-equals re-frozen.');
        assert.deepEqual(deepPopsicle, value, 'Re-frozen deep-equals original.');
      }

      test({});
      test({ a: 1 });
      test({ a: { b: 10 }, c: { d: 20 } });
      test([]);
      test([1]);
      test([[1, 2], [3, 4]]);
    });

    it('should return a deep-frozen object if passed one that isn\'t already deep-frozen', () => {
      // Good enough recursive frozen check for testing, but not good enough to
      // be in the main class.
      function isDeepFrozen(value) {
        if (!Object.isFrozen(value)) {
          return false;
        } else if (typeof value !== 'object') {
          return true;
        }

        for (const v of Object.values(value)) {
          if (!isDeepFrozen(v)) {
            return false;
          }
        }

        return true;
      }

      function test(value) {
        const popsicle = DataUtil.deepFreeze(value);
        assert.isTrue(isDeepFrozen(popsicle), value);
        assert.deepEqual(popsicle, value);
      }

      test({});
      test({ a: 1, b: 2 });
      test([]);
      test([1, 2, 'foo', 'bar']);
      test([[[[[[[[[['hello']]]]]]]]]]);
      test({ x: [[[[[123]]]]], y: [37, [37], [[37]], [[[37]]]], z: [{ x: 10 }] });
    });

    it('should not freeze the originally passed value', () => {
      const orig = [1, 2, 3];
      const popsicle = DataUtil.deepFreeze(orig);

      assert.isFrozen(popsicle);
      assert.isNotFrozen(orig);
    });

    it('should work on arrays with holes', () => {
      const orig = [1, 2, 3];
      orig[37]   = ['florp'];
      orig[914]  = [[['like']]];

      const popsicle = DataUtil.deepFreeze(orig);

      assert.isFrozen(popsicle);
      assert.deepEqual(popsicle, orig);
    });

    it('should work on arrays with additional string-named properties', () => {
      const orig = [1, 2, 3];
      orig.florp = ['florp'];
      orig.like  = [[['like']]];

      const popsicle = DataUtil.deepFreeze(orig);

      assert.isFrozen(popsicle);
      assert.deepEqual(popsicle, orig);
    });

    it('should work on arrays with additional symbol-named properties', () => {
      const orig = [1, 2, 3];
      orig[Symbol('florp')] = ['florp'];
      orig[Symbol('like')] = [[['like']]];

      const popsicle = DataUtil.deepFreeze(orig);

      assert.isFrozen(popsicle);
      assert.deepEqual(popsicle, orig);
    });

    it('should work on objects with symbol-named properties', () => {
      const orig = { a: 10, [Symbol('b')]: 20 };

      const popsicle = DataUtil.deepFreeze(orig);

      assert.isFrozen(popsicle);
      assert.deepEqual(popsicle, orig);
    });

    it('should fail if given a function or a composite that contains same', () => {
      function test(value) {
        assert.throws(() => { DataUtil.deepFreeze(value); });
      }

      test(test); // Because `test` is indeed a function!
      test(() => 123);
      test([1, 2, 3, test]);
      test([1, 2, 3, [[[[[test]]]]]]);
      test({ a: 10, b: test });
      test({ a: 10, b: { c: { d: test } } });
    });

    it('should fail if given a non-simple object or a composite that contains same', () => {
      function test(value) {
        assert.throws(() => { DataUtil.deepFreeze(value); });
      }

      const instance = new Number(10);
      const synthetic = {
        a: 10,
        get x() { return 20; }
      };

      test(instance);
      test(synthetic);
      test([instance]);
      test([1, 2, 3, [[[[[synthetic]]]]]]);
      test({ a: 10, b: instance });
      test({ a: 10, b: { c: { d: synthetic } } });
    });
  });
});
