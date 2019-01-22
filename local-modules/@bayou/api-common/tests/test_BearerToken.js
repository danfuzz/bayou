// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';

describe('@bayou/api-common/BearerToken', () => {
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
    it('is the `id` with the expected suffix', () => {
      const token = new BearerToken('foo', 'bar');

      assert.strictEqual(token.safeString, 'foo-...');
    });
  });

  describe('.secretToken', () => {
    it('is the `secretToken` passed to the constructor', () => {
      const secret = 'florp';
      const token = new BearerToken('x', secret);

      assert.strictEqual(token.secretToken, secret);
    });
  });

  describe('.url', () => {
    it('is always `*`', () => {
      const token = new BearerToken('some-id', 'some-secret');

      assert.strictEqual(token.url, '*');
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
});
