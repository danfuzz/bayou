// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from 'api-server';

const SECRET_TOKEN = 'Setec Astronomy Setec Astronomy ';

describe('api-server.BearerToken', () => {
  describe('#constructor(secret)', () => {
    it('should reject secrets with length < 32', () => {
      assert.throws(() => new BearerToken('Setec Astronomy'));
    });

    it('should return a frozen instane of BearerToken', () => {
      const token = new BearerToken(SECRET_TOKEN);

      assert.instanceOf(token, BearerToken);
      assert.isFrozen(token);
    });
  });

  describe('.secretToken', () => {
    it('should return the token provided to the constructor', () => {
      const token = new BearerToken(SECRET_TOKEN);

      assert.strictEqual(token.secretToken, SECRET_TOKEN);
    });
  });

  describe('#sameToken(other)', () => {
    it('should return false when passed null', () => {
      const token = new BearerToken(SECRET_TOKEN);

      assert.isFalse(token.sameToken(null));
    });

    it('should return false when passed undefined', () => {
      const token = new BearerToken(SECRET_TOKEN);

      assert.isFalse(token.sameToken(undefined));
    });

    it('should return false when passed a token with a different secret key', () => {
      const token = new BearerToken(SECRET_TOKEN);
      const other = new BearerToken('abcdefghijklmnopqrstuvwxyz012345');

      assert.isFalse(token.sameToken(other));
    });

    it('should return true when passed a token with the same secret key', () => {
      const token = new BearerToken(SECRET_TOKEN);
      const other = new BearerToken(SECRET_TOKEN);

      assert.isTrue(token.sameToken(other));
    });
  });

  describe('#sameArrays(array1, array2)', () => {
    it('should reject arrays that are different lengths', () => {
      const token1 = new BearerToken(SECRET_TOKEN);
      const token2 = new BearerToken(SECRET_TOKEN);
      const token3 = new BearerToken(SECRET_TOKEN);
      const token4 = new BearerToken(SECRET_TOKEN);

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3];

      assert.isFalse(BearerToken.sameArrays(array1, array2));
    });

    it('should throw an Error if given arrays that contain things other than BearerTokens', () => {
      const token1 = new BearerToken(SECRET_TOKEN);
      const token2 = new BearerToken(SECRET_TOKEN);
      const token3 = new BearerToken(SECRET_TOKEN);
      const token4 = new BearerToken(SECRET_TOKEN);

      const array1 = [token1, token2, token3, token4, 'a'];
      const array2 = [token1, token2, token3, token4, 'a'];

      assert.throws(() => BearerToken.sameArrays(array1, array2));
    });

    it('should accept identical arrays of BearerTokens', () => {
      const token1 = new BearerToken(SECRET_TOKEN);
      const token2 = new BearerToken(SECRET_TOKEN);
      const token3 = new BearerToken(SECRET_TOKEN);
      const token4 = new BearerToken(SECRET_TOKEN);

      const array1 = [token1, token2, token3, token4];
      const array2 = [token1, token2, token3, token4];

      assert.isTrue(BearerToken.sameArrays(array1, array2));
    });
  });
});
