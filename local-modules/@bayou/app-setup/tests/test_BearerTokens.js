// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-server';
import { BearerTokens } from '@bayou/app-setup';

describe('@bayou/app-setup/BearerTokens', () => {
  describe('constructor', () => {
    it('should succeed', () => {
      assert.doesNotThrow(() => new BearerTokens());
    });
  });

  describe('isToken()', () => {
    it('should accept any value', () => {
      const bt = new BearerTokens();
      assert.isTrue(bt.isToken('abc123'));
    });
  });

  describe('.rootTokens', () => {
    it('should be an array of `BearerToken` instances', () => {
      const bt     = new BearerTokens();
      const tokens = bt.rootTokens;

      assert.isArray(tokens);

      for (const token of tokens) {
        assert.instanceOf(token, BearerToken);
      }
    });
  });

  describe('tokenId()', () => {
    it('should return the first 16 characters of the string passed to it', () => {
      const bt              = new BearerTokens();
      const fakeTokenString = 'abcdefghijklmnopqrstuvwxyz';
      const tokenId         = bt.tokenId(fakeTokenString);

      assert.strictEqual(tokenId, fakeTokenString.slice(0, 16));
    });
  });

  describe('whenRootTokensChange()', () => {
    it('should return a promise', () => {
      const bt            = new BearerTokens();
      const changePromise = bt.whenRootTokensChange();

      assert.property(changePromise, 'then');
      assert.isFunction(changePromise.then);
    });
  });
});
