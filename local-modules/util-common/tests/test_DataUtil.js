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

  describe('bufferFromHex(value)', () => {
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
