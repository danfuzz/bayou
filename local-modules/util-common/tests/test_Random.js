// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import _ from 'lodash';

import { TString } from 'typecheck';
import { Random } from 'util-common';

/**
 * A basic test just to ensure that the test harness is functional.
 */
describe('util-common.Random', () => {
  describe('#byteArray(length)', () => {
    it('should return an array of the requested length', () => {
      const length = 17;
      const randomBytes = Random.byteArray(length);

      assert.equal(length, randomBytes.length);
    });

    it('should return different results every time', () => {
      const length = 23;
      const bytesA = Random.byteArray(length);
      const bytesB = Random.byteArray(length);

      assert(!_.isEqual(bytesA, bytesB));
    });
  });

  describe('#hexByteString(length)', () => {
    it('should return a string of hex digits of the requested length', () => {
      const length = 13;
      const string = Random.hexByteString(length);

      assert.doesNotThrow(() => TString.hexBytes(string, length));
    });
  });
});
