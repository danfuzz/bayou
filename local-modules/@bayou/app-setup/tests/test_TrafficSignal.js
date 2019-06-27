// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TrafficSignal } from '../TrafficSignal';

describe('@bayou/app-setup/TrafficSignal', () => {
  // **Note:** This file builds in assumptions about the values of the various
  // constants. If we find ourselves tweaking the constants a lot, we might want
  // to make the test more parametric.
  describe('_offTimeMsecFromLoadFactor()', () => {
    it('returns `0` for "non-loady" low values', () => {
      for (let lf = 0; lf < 75; lf++) {
        const got = TrafficSignal._offTimeMsecFromLoadFactor(lf);

        assert.strictEqual(got, 0, `load factor ${lf}`);
      }
    });

    it('returns the minimum off-time when at the low-end of the duty-cycle range', () => {
      const got = TrafficSignal._offTimeMsecFromLoadFactor(75);

      assert.strictEqual(got, 6667);
    });

    it('returns the maximum off-time when at the high-end of the duty-cycle range', () => {
      const got = TrafficSignal._offTimeMsecFromLoadFactor(150);

      assert.strictEqual(got, 60000);
    });

    it('returns the maximum off-time when the load factor is higher than the max end of the range', () => {
      for (let lf = 151; lf < 10000; lf = Math.floor(lf * 5 / 3)) {
        const got = TrafficSignal._offTimeMsecFromLoadFactor(lf);

        assert.strictEqual(got, 60000, `load factor ${lf}`);
      }
    });
  });
});
