// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-server';
import { Network } from '@bayou/config-server';

describe('@bayou/api-server/BearerToken', () => {
  const EXAMPLE_TOKEN = Network.bearerTokens.exampleToken;

  describe('constructor()', () => {
    it('should reject syntactically invalid secrets', () => {
      const badToken = `bad-token-${EXAMPLE_TOKEN.slice(0, 8)}`;
      assert.throws(() => new BearerToken(badToken));
    });

    it('should return a frozen instane of BearerToken', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);

      assert.instanceOf(token, BearerToken);
      assert.isFrozen(token);
    });
  });

  describe('.secretToken', () => {
    it('should return the token provided to the constructor', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);

      assert.strictEqual(token.secretToken, EXAMPLE_TOKEN);
    });
  });

  describe('sameToken()', () => {
    it('should return false when passed `null`', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);

      assert.isFalse(token.sameToken(null));
    });

    it('should return false when passed `undefined`', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);

      assert.isFalse(token.sameToken(undefined));
    });

    it('should return `false` when passed a token with a different secret key', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);
      const other = new BearerToken('abcdefghijklmnopqrstuvwxyz012345');

      assert.isFalse(token.sameToken(other));
    });

    it('should return `true` when passed a token with the same secret key', () => {
      const token = new BearerToken(EXAMPLE_TOKEN);
      const other = new BearerToken(EXAMPLE_TOKEN);

      assert.isTrue(token.sameToken(other));
    });
  });

  describe('sameArrays()', () => {
    it('should return `false` given arrays that are different lengths', () => {
      const token1 = new BearerToken(EXAMPLE_TOKEN);
      const token2 = new BearerToken(EXAMPLE_TOKEN);
      const token3 = new BearerToken(EXAMPLE_TOKEN);
      const token4 = new BearerToken(EXAMPLE_TOKEN);

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3];

      assert.isFalse(BearerToken.sameArrays(array1, array2));
    });

    it('should throw an Error if given arrays that contain things other than BearerTokens', () => {
      const token1 = new BearerToken(EXAMPLE_TOKEN);
      const token2 = new BearerToken(EXAMPLE_TOKEN);
      const token3 = new BearerToken(EXAMPLE_TOKEN);
      const token4 = new BearerToken(EXAMPLE_TOKEN);

      const array1 = [token1, token2, token3, token4, 'a'];
      const array2 = [token1, token2, token3, token4, 'a'];

      assert.throws(() => BearerToken.sameArrays(array1, array2));
    });

    it('should return `true` given identically-constructed arrays of BearerTokens', () => {
      const token1 = new BearerToken(EXAMPLE_TOKEN);
      const token2 = new BearerToken(EXAMPLE_TOKEN);
      const token3 = new BearerToken(EXAMPLE_TOKEN);
      const token4 = new BearerToken(EXAMPLE_TOKEN);

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3, token4];

      assert.isTrue(BearerToken.sameArrays(array1, array2));
    });
  });
});
