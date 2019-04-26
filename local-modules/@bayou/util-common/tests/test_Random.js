// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TString } from '@bayou/typecheck';
import { Random } from '@bayou/util-common';

describe('@bayou/util-common/Random', () => {
  describe('byteBuffer()', () => {
    it('returns a buffer of the requested length', () => {
      const length = 17;
      const randomBytes = Random.byteBuffer(length);

      assert.strictEqual(length, randomBytes.length);
    });

    it('returns different results every time', () => {
      const length = 23;
      const bytesA = Random.byteBuffer(length);
      const bytesB = Random.byteBuffer(length);

      assert.notDeepEqual(bytesA, bytesB);
    });
  });

  describe('hexByteString()', () => {
    it('returns a string of hex digits of the requested length', () => {
      const length = 13;
      const string = Random.hexByteString(length);

      assert.doesNotThrow(() => TString.hexBytes(string, length));
    });
  });

  describe('idString()', () => {
    it('should reject a non-string prefix', () => {
      assert.throws(() => Random.idString(true, 10));
    });

    it('should reject an empty prefix', () => {
      assert.throws(() => Random.idString('', 10));
    });

    it('should reject a non-number length', () => {
      assert.throws(() => Random.idString('x', 'foo'));
    });

    it('should reject a non-integer length', () => {
      assert.throws(() => Random.idString('x', 12.34));
    });

    it('should reject a non-positive length', () => {
      assert.throws(() => Random.idString('x', 0));
      assert.throws(() => Random.idString('x', -1));
    });

    it('returns a string that starts with the indicated prefix', () => {
      function test(p) {
        const result = Random.idString(p, 4);
        assert.isTrue(result.startsWith(`${p}-`));
      }

      test('a');
      test('foo');
      test('123456');
    });

    it('returns a string with the expected number and kind of characters after the prefix', () => {
      function test(l) {
        const result = Random.idString('x', l);
        assert.lengthOf(result, l + 2);

        const suffix = result.match(/-(.*)$/)[1];
        assert.lengthOf(suffix, l);

        assert.isTrue(/^[0-9a-z]+$/.test(suffix));
      }

      test(1);
      test(2);
      test(3);
      test(50);
    });
  });

  describe('shortLabel()', () => {
    it('returns a probably-random string of the form "[prefix]-[8 * base32ish random character]"', () => {
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
