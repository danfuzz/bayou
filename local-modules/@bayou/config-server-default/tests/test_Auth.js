// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-server';
import { Auth } from '@bayou/config-server-default';

describe('@bayou/config-server-default/Auth', () => {
  describe('.exampleTokens', () => {
    it('should be an array of strings that are all `isToken()`', () => {
      const tokens = Auth.exampleTokens;

      assert.isArray(tokens);

      for (const token of tokens) {
        assert.isString(token);
        assert.isTrue(Auth.isToken(token));
      }
    });
  });

  describe('.rootTokens', () => {
    it('should be an array of `BearerToken` instances', () => {
      const tokens = Auth.rootTokens;

      assert.isArray(tokens);

      for (const token of tokens) {
        assert.instanceOf(token, BearerToken);
      }
    });
  });

  describe('isToken()', () => {
    it('should accept token syntax', () => {
      assert.isTrue(Auth.isToken('tok-00000000000000001123456789abcdef'));
    });

    it('should reject non-token syntax', () => {
      assert.isFalse(Auth.isToken('zzz-0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('tok-z0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('tok-00000000000000001123456789abcdef1'));
      assert.isFalse(Auth.isToken('tok-0000000000000000-1123456789abcdef'));
    });
  });

  describe('tokenFromString()', () => {
    it('should construct a token with the expected parts, given a valid token', () => {
      const id    = 'tok-0123456776543210';
      const full  = `${id}aaaaaaaaaaaaaaa1`;
      const token = Auth.tokenFromString(full);

      assert.strictEqual(token.id, id);
      assert.strictEqual(token.secretToken, full);
    });
  });

  describe('tokenId()', () => {
    it('should extract the ID of a valid token', () => {
      const id    = 'tok-0123456776543210';
      const token = `${id}bbbbbbbbbbbbbbbb`;
      assert.strictEqual(Auth.tokenId(token), id);
    });
  });

  describe('whenRootTokensChange()', () => {
    it('should return a promise', () => {
      const changePromise = Auth.whenRootTokensChange();

      assert.property(changePromise, 'then');
      assert.isFunction(changePromise.then);
    });
  });
});
