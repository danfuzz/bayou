// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-server';
import { BearerTokens } from '@bayou/hooks-server';

const BEARER_TOKENS = BearerTokens.theOne;

describe('@bayou/hooks-server/BearerTokens', () => {
  describe('isToken(tokenString)', () => {
    it('should accept any value', () => {
      assert.isTrue(BEARER_TOKENS.isToken('abc123'));
    });
  });

  describe('.rootTokens', () => {
    it('should return an array of BearerToken', () => {
      const tokens = BEARER_TOKENS.rootTokens;

      assert.isArray(tokens);

      for (const token of tokens) {
        assert.instanceOf(token, BearerToken);
      }
    });
  });

  describe('tokenId(tokenString)', () => {
    it('should return the first 16 characters of the string passed to it', () => {
      const fakeTokenString = 'abcdefghijklmnopqrstuvwxyz';
      const tokenId = BEARER_TOKENS.tokenId(fakeTokenString);

      assert.strictEqual(tokenId, fakeTokenString.slice(0, 16));
    });
  });

  describe('whenRootTokensChange()', () => {
    it('should return a promise', () => {
      const changePromise = BEARER_TOKENS.whenRootTokensChange();

      assert.property(changePromise, 'then');
      assert.isFunction(changePromise.then);
    });
  });
});
