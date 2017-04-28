// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DataUtil } from 'util-common';

describe('util-common/DataUtil', () => {
  describe('deepFreeze(value)', () => {
    it('should return the provided value if it is a primitive', () => {
      const symbol = Symbol('foo');

      assert.strictEqual(DataUtil.deepFreeze(true), true);
      assert.strictEqual(DataUtil.deepFreeze(37), 37);
      assert.strictEqual(DataUtil.deepFreeze('a string'), 'a string');
      assert.strictEqual(DataUtil.deepFreeze(symbol), symbol);
      assert.strictEqual(DataUtil.deepFreeze(undefined), undefined);
    });

    it('should return null if provided a null object', () => {
      assert.isNull(DataUtil.deepFreeze(null));
    });

    it('should return the provided value if it is already deep-frozen', () => {
      const object = { 'a': 1, 'b': 2 };
      const popsicle = DataUtil.deepFreeze(object);

      assert.isTrue(popsicle === DataUtil.deepFreeze(popsicle));
    });

    it('should return a deep-frozen object if passed one that isn\'t already deep-frozen', () => {
      const object = { 'a': 1, 'b': 2 };
      const popsicle = DataUtil.deepFreeze(object);

      assert.throws(() => popsicle['a'] = 37);
    });
  });

  describe('bytesFromHex(value)', () => {
    it('should throw an Error if passed an odd-lengthed string', () => {
      assert.throws(() => DataUtil.bytesFromHex('aabbc'));
    });

    it('should throw an error if pass a string that isn\'t solely hex bytes', () => {
      assert.throws(() => DataUtil.bytesFromHex('this better not work!'));
    });

    it('should return an array of ints when passed a valid hex string', () => {
      const bytesArray = DataUtil.bytesFromHex('deadbeef');

      assert.isTrue(Array.isArray(bytesArray));

      for (const value of bytesArray) {
        assert.isTrue(Number.isSafeInteger(value));
      }

      assert.strictEqual(bytesArray[0], 0xde);
      assert.strictEqual(bytesArray[1], 0xad);
      assert.strictEqual(bytesArray[2], 0xbe);
      assert.strictEqual(bytesArray[3], 0xef);
    });
  });

  describe('hexFromBytes(value)', () => {
    it('should throw an Error if passed anything but an array of byte values', () => {
      assert.throws(() => DataUtil.hexFromBytes('this better not work!'));
      assert.throws(() => DataUtil.hexFromBytes(37));
      assert.throws(() => DataUtil.hexFromBytes(true));
      assert.throws(() => DataUtil.hexFromBytes({}));
      assert.throws(() => DataUtil.hexFromBytes(['foo', true, {}]));
      assert.throws(() => DataUtil.hexFromBytes(true));
      assert.throws(() => DataUtil.hexFromBytes([298374, 203849023, 92837492374, 29384]));
    });

    it('should return a hex string if passed an array of byte values', () => {
      const bytesArray = [0xde, 0xad, 0xbe, 0xef];

      assert.strictEqual(DataUtil.hexFromBytes(bytesArray), 'deadbeef');
    });
  });
});
