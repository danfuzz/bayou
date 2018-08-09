// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-server';
import { Auth as configServer_Auth } from '@bayou/config-server';
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
    // For now, this test is effectively disabled if the configured `Auth` class
    // isn't the one from this module, because the `BearerToken` constructor
    // checks token syntax via the configured class, which might have a
    // different rule than what's enforced by this module. **TODO:** Fix this
    // mess. In particular, `BearerToken` should probably not be in the
    // business of enforcing syntax nor parsing out token bits. Instead, it
    // should accept the parsed bits as input to its constructor.
    if (configServer_Auth !== Auth) {
      it('trivially passes due to insufficient modularity.', () => {
        assert.isTrue(true);
      });
      return;
    }

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
      assert.isTrue(Auth.isToken('00000000000000001123456789abcdef'));
    });

    it('should reject non-token syntax', () => {
      assert.isFalse(Auth.isToken('z0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('00000000000000001123456789abcdef1'));
      assert.isFalse(Auth.isToken('0000000000000000-1123456789abcdef'));
    });
  });

  describe('tokenId()', () => {
    it('should extract the ID of a valid token', () => {
      const id = '0123456776543210';
      const token = `${id}bbbbbbbbbbbbbbbb`;
      assert.strictEqual(Auth.tokenId(token), id);
    });
  });
});
