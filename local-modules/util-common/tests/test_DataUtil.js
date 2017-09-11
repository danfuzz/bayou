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
  });

  describe('bufferFromHex()', () => {
    it('should throw an Error if passed an odd-lengthed string', () => {
      assert.throws(() => DataUtil.bufferFromHex('aabbc'));
    });

    it('should throw an error if pass a string that isn\'t solely hex bytes', () => {
      assert.throws(() => DataUtil.bufferFromHex('this better not work!'));
    });

    it('should return a buffer when passed a valid hex string', () => {
      const bytes = DataUtil.bufferFromHex('deadbeef');

      assert.isTrue(Buffer.isBuffer(bytes));

      assert.strictEqual(bytes.length, 4);
      assert.strictEqual(bytes[0], 0xde);
      assert.strictEqual(bytes[1], 0xad);
      assert.strictEqual(bytes[2], 0xbe);
      assert.strictEqual(bytes[3], 0xef);
    });
  });
});
