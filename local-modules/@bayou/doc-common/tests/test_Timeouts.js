// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Timeouts } from '@bayou/doc-common';

describe('@bayou/doc-common/Timeouts', () => {
  describe('.MAX_TIMEOUT_MSEC', () => {
    it('should be an integer', () => {
      const max = Timeouts.MAX_TIMEOUT_MSEC;
      assert.isTrue(Number.isSafeInteger(max));
    });

    it('should be greater than the minimum', () => {
      const max = Timeouts.MAX_TIMEOUT_MSEC;
      const min = Timeouts.MIN_TIMEOUT_MSEC;
      assert.isTrue(max > min);
    });
  });

  describe('.MIN_TIMEOUT_MSEC', () => {
    it('should be a positive integer', () => {
      const min = Timeouts.MIN_TIMEOUT_MSEC;
      assert.isTrue(Number.isSafeInteger(min));
      assert.isAtLeast(min, 0);
    });
  });

  describe('clamp()', () => {
    it('should convert `null` to the maximum', () => {
      assert.strictEqual(Timeouts.clamp(null), Timeouts.MAX_TIMEOUT_MSEC);
    });

    it('accepts in-range integers as-is', () => {
      const min = Timeouts.MIN_TIMEOUT_MSEC;
      const max = Timeouts.MAX_TIMEOUT_MSEC;

      for (let i = min; i < max; i += 1234) {
        assert.strictEqual(Timeouts.clamp(i), i);
      }

      assert.strictEqual(Timeouts.clamp(max), max);
    });

    it('should clamp too-low whole numbers to the minimum', () => {
      const min = Timeouts.MIN_TIMEOUT_MSEC;

      for (let i = 0; i < min; i += 37) {
        assert.strictEqual(Timeouts.clamp(i), min);
      }
    });

    it('should clamp too-high integers to the maximum', () => {
      const max = Timeouts.MAX_TIMEOUT_MSEC;

      for (let i = max + 1; i < (max * 100); i += 1234567) {
        assert.strictEqual(Timeouts.clamp(i), max);
      }
    });

    it('rejects negative numbers', () => {
      assert.throws(() => Timeouts.clamp(-1));
      assert.throws(() => Timeouts.clamp(-0.01));
      assert.throws(() => Timeouts.clamp(-123));
    });

    it('rejects non-numbers that are not `null`', () => {
      assert.throws(() => Timeouts.clamp(undefined));
      assert.throws(() => Timeouts.clamp(false));
      assert.throws(() => Timeouts.clamp('123'));
    });
  });
});
