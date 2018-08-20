// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { BaseAuth } from '@bayou/config-server';
import { Auth } from '@bayou/config-server-default';

/**
 * {string} Valid token string which is not expected to ever bear any authority.
 */
const EXAMPLE_TOKEN = 'tok-00000000000000001123456789abcdef';

/**
 * {string} The well-known root token used by this module.
 *
 * **Note:** This module (the default server config) is intentionally set up to
 * have a single well-known root token. Any real deployment of this project will
 * (had better!) use a _different_ configuration module.
 */
const ROOT_TOKEN = 'tok-00000000000000000000000000000000';

describe('@bayou/config-server-default/Auth', () => {
  it('inherits from `BaseAuth`', () => {
    assert.isTrue(Auth.prototype instanceof BaseAuth);
  });

  describe('.rootTokens', () => {
    it('should be an array of `BearerToken` instances', () => {
      const tokens = Auth.rootTokens;

      assert.isArray(tokens);

      for (const token of tokens) {
        assert.instanceOf(token, BearerToken);
      }
    });

    it('should have only the one well-known token in it', () => {
      assert.lengthOf(Auth.rootTokens, 1);
      assert.strictEqual(Auth.rootTokens[0].secretToken, ROOT_TOKEN);
    });
  });

  describe('isToken()', () => {
    it('should accept token syntax', () => {
      assert.isTrue(Auth.isToken(EXAMPLE_TOKEN));
    });

    it('should reject non-token syntax', () => {
      assert.isFalse(Auth.isToken('zzz-0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('tok-z0000000000000001123456789abcdef'));
      assert.isFalse(Auth.isToken('tok-00000000000000001123456789abcdef1'));
      assert.isFalse(Auth.isToken('tok-0000000000000000-1123456789abcdef'));
    });
  });

  describe('tokenAuthority()', () => {
    it('should reject non-token values', async () => {
      async function test(x) {
        await assert.isRejected(Auth.tokenAuthority(x), /badValue/);
      }

      await test(undefined);
      await test(null);
      await test('florp');
      await test(EXAMPLE_TOKEN); // Requires a token object, not a string.
    });

    it('should indicate "no auth" for an unknown token', async () => {
      const token = Auth.tokenFromString(EXAMPLE_TOKEN);
      const auth  = await Auth.tokenAuthority(token);

      assert.deepEqual(auth, { type: Auth.TYPE_none });
    });

    it('should indicate "root auth" for the staticly-known root token', async () => {
      const token = Auth.tokenFromString(ROOT_TOKEN);
      const auth  = await Auth.tokenAuthority(token);

      assert.deepEqual(auth, { type: Auth.TYPE_root });
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
});
