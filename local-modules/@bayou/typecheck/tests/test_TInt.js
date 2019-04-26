// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TInt } from '@bayou/typecheck';

describe('@bayou/typecheck/TInt', () => {
  describe('check()', () => {
    it('should accept safe integers', () => {
      function test(value) {
        assert.strictEqual(TInt.check(value), value);
      }

      test(-1);
      test(0);
      test(1);
      test(10000000);
    });

    it('should reject numbers which are not safe integers', () => {
      assert.throws(() => TInt.check(3.1));
      assert.throws(() => TInt.check(NaN));
      assert.throws(() => TInt.check(1e100));
    });

    it('should reject a non-number value', () => {
      assert.throws(() => TInt.check('this better not work'));
    });
  });

  describe('maxExc()', () => {
    it('accepts in-range integers', () => {
      function test(value, maxExc) {
        assert.strictEqual(TInt.maxExc(value, maxExc), value);
      }

      test(-1,  0);
      test(-1,  1);
      test(-1,  10);
      test(0,   1);
      test(0,   1000000);
      test(123, 914);
      test(913, 914);
    });

    it('rejects out-of-range integers', () => {
      function test(value, maxExc) {
        assert.throws(() => TInt.maxExc(value, maxExc), /^badValue/);
      }

      test(-1,  -2);
      test(0,   -1);
      test(0,   -1200);
      test(100, 99);
      test(100, 90);
      test(100, -9000);
    });
  });

  describe('maxInc()', () => {
    it('should allow value <= maxInc', () => {
      assert.doesNotThrow(() => TInt.maxInc(4, 4));
      assert.doesNotThrow(() => TInt.maxInc(4, 5));
    });

    it('throws an error when `value > maxInc`', () => {
      assert.throws(() => TInt.maxInc(4, 3));
    });
  });

  describe('min()', () => {
    it('accepts in-range integers', () => {
      function test(value, minInc) {
        assert.strictEqual(TInt.min(value, minInc), value);
      }

      test(-1,    -1);
      test(-1,    -10);
      test(0,     -123);
      test(0,     0);
      test(10000, 100);
    });

    it('rejects out-of-range integers', () => {
      function test(value, minInc) {
        assert.throws(() => TInt.min(value, minInc), /^badValue/);
      }

      test(-1,  0);
      test(0,   1);
      test(0,   12);
      test(100, 101);
      test(100, 1200);
    });
  });

  describe('range()', () => {
    it('accepts in-range integers', () => {
      function test(value, minInc, maxExc) {
        assert.strictEqual(TInt.range(value, minInc, maxExc), value);
      }

      test(-1,  -1,   10);
      test(-1,  -2,   0);
      test(0,   0,    1);
      test(0,   0,    2);
      test(0,   -1,   2);
      test(0,   -123, 456);
      test(40,  38,   41);
      test(40,  39,   900);
      test(40,  40,   7123);
    });

    it('rejects out-of-range integers', () => {
      function test(value, minInc, maxExc) {
        assert.throws(() => TInt.range(value, minInc, maxExc), /^badValue/);
      }

      test(-1,  0,   10);
      test(-1,  -20, -1);
      test(0,   -100, -10);
      test(0,   -100, 0);
      test(0,   1,    2);
      test(10,  0,    9);
      test(10,  4,    10);
      test(10,  11,   100);
      test(10,  12,   100);
    });
  });

  describe('rangeInc()', () => {
    it('should allow `minInc <= value <= maxInc`', () => {
      assert.doesNotThrow(() => TInt.rangeInc(11, 3, 27));
    });

    it('throws an error when `value < minInc`', () => {
      assert.throws(() => TInt.rangeInc(2, 3, 27));
    });

    it('should not throw an error when `value === maxInc`', () => {
      assert.doesNotThrow(() => TInt.rangeInc(27, 3, 27));
    });

    it('throws an error when `value > maxInc`', () => {
      assert.throws(() => TInt.rangeInc(37, 3, 27));
    });
  });

  describe('unsignedByte()', () => {
    it('should allow integer values in range `[0..255]`', () => {
      assert.strictEqual(TInt.unsignedByte(0),   0);
      assert.strictEqual(TInt.unsignedByte(1),   1);
      assert.strictEqual(TInt.unsignedByte(128), 128);
      assert.strictEqual(TInt.unsignedByte(255), 255);
    });

    it('throws an error when value is outsid of range `[0..255]`', () => {
      assert.throws(() => TInt.unsgignedByte(-1));
      assert.throws(() => TInt.unsgignedByte(256));
    });
  });
});
