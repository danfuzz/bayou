// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';

describe('@bayou/api-common/BearerToken', () => {
  describe('redactString()', () => {
    it('fully redacts strings of length 11 or shorter', () => {
      const FULL_STRING   = '1234567890x';
      const EXPECT_STRING = '...';

      for (let i = 0; i < FULL_STRING.length; i++) {
        assert.strictEqual(BearerToken.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });

    it('drops all but the first 8 characters of strings of length 12 through 23', () => {
      const FULL_STRING   = '1234567890abcdefghijklm';
      const EXPECT_STRING = '12345678...';

      for (let i = 12; i < FULL_STRING.length; i++) {
        assert.strictEqual(BearerToken.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });

    it('drops all but the first 16 characters of strings of length 24 or greater', () => {
      const FULL_STRING   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz';
      const EXPECT_STRING = 'ABCDEFGHIJKLMNOP...';

      for (let i = 24; i < FULL_STRING.length; i++) {
        assert.strictEqual(BearerToken.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });
  });

  describe('constructor()', () => {
    it('returns a frozen instance', () => {
      const token = new BearerToken('x', 'y');

      assert.isFrozen(token);
    });
  });

  describe('.id', () => {
    it('is the `id` passed to the constructor', () => {
      const token = new BearerToken('some-id', 'some-secret');

      assert.strictEqual(token.id, 'some-id');
    });
  });

  describe('.safeString', () => {
    it('is the `id` with the expected prefix and/or suffix', () => {
      function test(id, secret, expect) {
        const token = new BearerToken(id, secret);
        assert.strictEqual(token.safeString, expect);
      }

      test('foo', 'foo-bar', 'foo-...');
      test('bar', 'foo-bar', '...-bar');
      test('bar', 'foo-bar-baz', '...-bar-...');

      // Fallback case: The ID doesn't actually appear within the full token.
      test('blortch', 'splorp', 'blortch-...');
    });
  });

  describe('.secretToken', () => {
    it('is the `secretToken` passed to the constructor', () => {
      const secret = 'florp';
      const token = new BearerToken('x', secret);

      assert.strictEqual(token.secretToken, secret);
    });
  });

  describe('sameToken()', () => {
    it('returns `false` when passed `null`', () => {
      const token = new BearerToken('x', 'y');

      assert.isFalse(token.sameToken(null));
    });

    it('returns `false` when passed `undefined`', () => {
      const token = new BearerToken('x', 'y');

      assert.isFalse(token.sameToken(undefined));
    });

    it('returns `false` when passed a token with a different `secretToken`', () => {
      const token = new BearerToken('x', 'y');
      const other = new BearerToken('x', 'z');

      assert.isFalse(token.sameToken(other));
    });

    it('returns `false` when passed a token with a different `id`', () => {
      const token = new BearerToken('x', 'y');
      const other = new BearerToken('z', 'y');

      assert.isFalse(token.sameToken(other));
    });

    it('returns `true` when passed an identically-constructed token', () => {
      const token = new BearerToken('x', 'y');
      const other = new BearerToken('x', 'y');

      assert.isTrue(token.sameToken(other));
    });
  });

  describe('sameArrays()', () => {
    it('returns `false` given arrays of different length', () => {
      const token1 = new BearerToken('a', '1');
      const token2 = new BearerToken('b', '2');
      const token3 = new BearerToken('c', '3');
      const token4 = new BearerToken('d', '4');

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3];

      assert.isFalse(BearerToken.sameArrays(array1, array2));
    });

    it('throws when given arrays that contain things other than `BearerToken`s', () => {
      const token = new BearerToken('a', '1');

      const array1 = [token, 'a'];
      const array2 = [token, 'a'];

      assert.throws(() => BearerToken.sameArrays(array1, array2));
    });

    it('returns `true` given identically-constructed arrays of `BearerToken`s', () => {
      const token1 = new BearerToken('a', '1');
      const token2 = new BearerToken('b', '2');
      const token3 = new BearerToken('c', '3');
      const token4 = new BearerToken('d', '4');

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3, token4];

      assert.isTrue(BearerToken.sameArrays(array1, array2));
    });
  });

  describe('toString()', () => {
    it('returns a string', () => {
      const t = new BearerToken('zorch', 'splat');

      assert.isString(t.toString());
    });

    it('returns a string that contains the ID', () => {
      function test(id) {
        const t      = new BearerToken(id, 'boop');
        const result = t.toString();

        assert.isTrue(result.indexOf(id) >= 0, id);
      }

      test('x');
      test('123-florp');
      test('a');
      test('like');
    });

    it('returns a string that does not contain the secret', () => {
      function test(secret) {
        const t      = new BearerToken('xyz', secret);
        const result = t.toString();

        assert.isTrue(result.indexOf(secret) < 0);
      }

      test('hello');
      test('123-florp');
      test('yoyoyoyoyo');
      test('like');
    });
  });
});
