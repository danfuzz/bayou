// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { RevisionNumber } from '@bayou/ot-common';

/**
 * Helper to call a given method and ensure that it rejects numbers that aren't
 * non-negative integers.
 *
 * @param {string} name Method name.
 * @param {...*} args Additional arguments.
 */
function rejectBadNumbers(name, ...args) {
  function test(value) {
    assert.throws(() => RevisionNumber[name](value, ...args), /^badValue/);
  }

  test(-1);
  test(-0.0001);
  test(0.5);
  test(10000000.123);
  test(Infinity);
  test(NaN);
}

/**
 * Helper to call a given method and ensure that it rejects non-numbers.
 *
 * @param {string} name Method name.
 * @param {...*} args Additional arguments.
 */
function rejectNonNumbers(name, ...args) {
  function test(value) {
    assert.throws(() => RevisionNumber[name](value, ...args), /^badValue/);
  }

  test(null);
  test(undefined);
  test(false);
  test(true);
  test('10');
  test([10]);
  test({ a: 10 });
  test(new Map());
}

describe('@bayou/ot-common/RevisionNumber', () => {
  describe('check()', () => {
    it('accepts non-negative integers', () => {
      function test(value) {
        assert.strictEqual(RevisionNumber.check(value), value);
      }

      test(0);
      test(1);
      test(2);
      test(37);
      test(242);
      test(914);
      test(900090009);
    });

    it('rejects other numbers', () => {
      rejectBadNumbers('check');
    });

    it('rejects non-numbers', () => {
      rejectNonNumbers('check');
    });
  });

  describe('maxExc()', () => {
    it('accepts non-negative integers up to the specified limit', () => {
      function test(value, limit) {
        assert.strictEqual(RevisionNumber.maxExc(value, limit), value);
      }

      test(0,  1);
      test(0,  10);
      test(0,  100);
      test(2,  3);
      test(2,  33333);
      test(37, 39);
    });

    it('rejects non-negative integers beyond the specified limit', () => {
      function test(value, limit) {
        assert.throws(() => RevisionNumber.maxExc(value, limit), /^badValue/);
      }

      test(0,   0);
      test(1,   0);
      test(1,   1);
      test(100, 1);
      test(100, 99);
    });

    it('rejects other numbers', () => {
      rejectBadNumbers('maxExc', 10);
    });

    it('rejects non-numbers', () => {
      rejectNonNumbers('maxExc', 10);
    });
  });

  describe('maxInc()', () => {
    it('accepts non-negative integers up to the specified limit', () => {
      function test(value, limit) {
        assert.strictEqual(RevisionNumber.maxInc(value, limit), value);
      }

      test(0,  0);
      test(0,  1);
      test(0,  10);
      test(0,  100);
      test(2,  2);
      test(2,  3);
      test(2,  33333);
      test(37, 39);
      test(37, 38);
      test(37, 37);
    });

    it('rejects non-negative integers beyond the specified limit', () => {
      function test(value, limit) {
        assert.throws(() => RevisionNumber.maxInc(value, limit), /^badValue/);
      }

      test(1,   0);
      test(2,   1);
      test(2,   0);
      test(100, 99);
      test(100, 98);
    });

    it('rejects other numbers', () => {
      rejectBadNumbers('maxInc', 10);
    });

    it('rejects non-numbers', () => {
      rejectNonNumbers('maxInc', 10);
    });
  });

  describe('min()', () => {
    it('accepts non-negative integers at or beyond the specified limit', () => {
      function test(value, limit) {
        assert.strictEqual(RevisionNumber.min(value, limit), value);
      }

      test(0,   0);
      test(1,   0);
      test(10,  0);
      test(1,   1);
      test(99,  1);
      test(333, 333);
      test(333, 300);
    });

    it('rejects non-negative integers below the specified limit', () => {
      function test(value, limit) {
        assert.throws(() => RevisionNumber.min(value, limit), /^badValue/);
      }

      test(0,   1);
      test(0,   2);
      test(0,   3);
      test(1,   2);
      test(100, 101);
      test(100, 10000);
    });

    it('rejects other numbers', () => {
      rejectBadNumbers('min', 10);
    });

    it('rejects non-numbers', () => {
      rejectNonNumbers('min', 10);
    });
  });

  describe('orNeg1()', () => {
    it('accepts non-negative integers', () => {
      function test(value) {
        assert.strictEqual(RevisionNumber.orNeg1(value), value);
      }

      test(0);
      test(1);
      test(2);
      test(37);
      test(242);
      test(914);
      test(900090009);
    });

    it('accepts `-1`', () => {
      assert.strictEqual(RevisionNumber.orNeg1(-1), -1);
    });

    it('rejects other numbers', () => {
      function test(value) {
        assert.throws(() => RevisionNumber.orNeg1(value), /^badValue/);
      }

      test(-2);
      test(-0.0001);
      test(0.5);
      test(10000000.123);
      test(Infinity);
      test(NaN);
    });

    it('rejects non-numbers', () => {
      rejectNonNumbers('orNeg1');
    });
  });
});
