// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import _ from 'lodash';

import { TString } from 'typecheck';
import { Random } from 'util-common';

describe('util-common.Random', () => {
  describe('#byteArray(length)', () => {
    it('should return an array of the requested length', () => {
      const length = 17;
      const randomBytes = Random.byteArray(length);

      assert.strictEqual(length, randomBytes.length);
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

  describe('#shortLabel(prefix)', () => {
    it('should return a probably-random string of the form "[prefix]-[8 * base32ish random character]"', () => {
      const label1A = Random.shortLabel('A');
      const label2A = Random.shortLabel('A');

      assert.notEqual(label1A, label2A);
      assert.isTrue(label1A.indexOf('A-') === 0);
      assert.isTrue(label2A.indexOf('A-') === 0);
      assert.lengthOf(label1A, 10);
      assert.lengthOf(label2A, 10);
    });
  });
});
