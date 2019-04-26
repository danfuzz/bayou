// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TNumber } from '@bayou/typecheck';

describe('@bayou/typecheck/TNumber', () => {
  describe('check()', () => {
    it('returns the provided value when passed a number', () => {
      function test(v) {
        assert.strictEqual(TNumber.check(v), v);
      }

      test(0);
      test(1);
      test(1.5);
      test(Infinity);
      test(-Infinity);
    });

    it('accepts NaN', () => {
      // NaN somewhat ironically is in fact a number in this sense. But also,
      // because of IEEE754 wackiness, `NaN !== NaN`, so the usual strict
      // equality test can't be done.
      assert.isNaN(TNumber.check(NaN));
    });

    it('throws an error when passed a non-number value', () => {
      function test(v) {
        assert.throws(() => TNumber.check(v));
      }

      test(undefined);
      test(null);
      test(true);
      test('');
      test('5');
      test([1, 2, 3]);
    });
  });

  describe('range()', () => {
    it('should allow values in the specified range', () => {
      function test(v, minInc, maxExc) {
        assert.strictEqual(TNumber.range(v, minInc, maxExc), v);
      }

      test(10,      10, 12);
      test(10.01,   10, 12);
      test(11.9999, 10, 12);

      test(0, -1, 1);
    });

    it('should disallow values out of the specified range', () => {
      function test(v, minInc, maxExc) {
        assert.throws(() => TNumber.range(v, minInc, maxExc));
      }

      test(0,       37, 914);
      test(36,      37, 914);
      test(36.9999, 37, 914);
      test(914,     37, 914);
      test(914.001, 37, 914);
      test(10000,   37, 914);
    });
  });

  describe('rangeInc()', () => {
    it('should allow values in the specified range', () => {
      function test(v, minInc, maxInc) {
        assert.strictEqual(TNumber.rangeInc(v, minInc, maxInc), v);
      }

      test(10,      10, 12);
      test(10.01,   10, 12);
      test(11.9999, 10, 12);
      test(12,      10, 12);

      test(0, -1, 1);
    });

    it('should disallow values out of the specified range', () => {
      function test(v, minInc, maxInc) {
        assert.throws(() => TNumber.rangeInc(v, minInc, maxInc));
      }

      test(0,       37, 914);
      test(36,      37, 914);
      test(36.9999, 37, 914);
      test(914.001, 37, 914);
      test(10000,   37, 914);
    });
  });
});
