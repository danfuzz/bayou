// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Units } from '@bayou/util-common';

const splitFilesizeString = (string) => {
  const regex = /^([0-9]+)(\.([0-9]+))? ([kMGTPEZY]B)$/;
  const [match, wholeUnits, decimalComplex, decimals, units] = regex.exec(string);

  return {
    match,
    wholeUnits,
    decimalComplex,
    decimals,
    units
  };
};

describe('@bayou/util-common/Units', () => {
  describe('Units.filesizeToString(byteCount, decimalPlaces)', () => {
    it('should throw an exception if passed a negative byte count', () => {
      assert.throws(() => Units.filesizeToString(-100));
    });

    it('should throw an exception if passed a negative decimal place count', () => {
      assert.throws(() => Units.filesizeToString(100, -3));
    });

    it('should throw an exception if more than 4 decimal places are requested', () => {
      assert.throws(() => Units.filesizeToString(100, 5));
    });

    it('should default to zero decimal places when passed a single argument', () => {
      const output = Units.filesizeToString(123456);
      const fields = splitFilesizeString(output);

      assert.isUndefined(fields.decimalComplex);
    });

    it('should have the requested number of decial places when that argument is supplied', () => {
      const zeroOutput = Units.filesizeToString(1234, 0);
      const { decimals: zeroDecimals } = splitFilesizeString(zeroOutput);

      assert.isUndefined(zeroDecimals);

      for (let i = 1; i < 5; i++) {
        const output = Units.filesizeToString(1234, i);
        const { decimals } = splitFilesizeString(output);

        assert.equal(decimals.length, i);
      }
    });

    it('should return byte units for values under 1024', () => {
      const output = Units.filesizeToString(1023);

      assert.equal(output, '1023 bytes');
    });

    function testRange(power, units) {
      const lowOutput = Units.filesizeToString(Math.pow(1024, power));
      const highOutput = Units.filesizeToString(Math.pow(1024, power) + 1023);
      const { units: lowUnits } = splitFilesizeString(lowOutput);
      const { units: highUnits } = splitFilesizeString(highOutput);

      assert.equal(lowUnits, units);
      assert.equal(highUnits, units);
    }

    it('should use kB for values 1024^1 - (1024^2 - 1)', () => {
      testRange(1, 'kB');
    });

    it('should use MB for values 1024^2 - (1024^3 - 1)', () => {
      testRange(2, 'MB');
    });

    it('should use GB for values 1024^3 - (1024^4 - 1)', () => {
      testRange(3, 'GB');
    });

    it('should use TB for values 1024^4 - (1024^5 - 1)', () => {
      testRange(4, 'TB');
    });
  });
});
