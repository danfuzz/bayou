// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TString } from 'typecheck';
import { Random } from 'util-common';

describe('util-common/Random', () => {
  describe('byteBuffer()', () => {
    it('should return a buffer of the requested length', () => {
      const length = 17;
      const randomBytes = Random.byteBuffer(length);

      assert.strictEqual(length, randomBytes.length);
    });

    it('should return different results every time', () => {
      const length = 23;
      const bytesA = Random.byteBuffer(length);
      const bytesB = Random.byteBuffer(length);

      assert.notDeepEqual(bytesA, bytesB);
    });
  });

  describe('hexByteString()', () => {
    it('should return a string of hex digits of the requested length', () => {
      const length = 13;
      const string = Random.hexByteString(length);

      assert.doesNotThrow(() => TString.hexBytes(string, length));
    });
  });

  describe('shortLabel()', () => {
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
