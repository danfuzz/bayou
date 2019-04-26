// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { BaseAuth } from '@bayou/config-server';
import { Auth } from '@bayou/config-server-default';

/**
 * {array<string>} Valid token strings which are not expected to ever bear any
 * authority.
 */
const EXAMPLE_TOKENS = [
  'root-00000000-12345678',
  'autr-000000ff-aaabbbcc'
];

/**
 * {string} The well-known root token used by this module.
 *
 * **Note:** This module (the default server config) is intentionally set up to
 * have a single well-known root token. Any real deployment of this project will
 * (had better!) use a _different_ configuration module.
 */
const ROOT_TOKEN = 'root-00000000-00000000';

describe('@bayou/config-server-default/Auth', () => {
  it('inherits from `BaseAuth`', () => {
    assert.isTrue(Auth.prototype instanceof BaseAuth);
  });

  describe('.nonTokenPrefix', () => {
    it('is a short but nonempty lowercase alpha string, ending with a dash', () => {
      const prefix = Auth.nonTokenPrefix;

      assert.isString(prefix, prefix);
      assert.isTrue(/^[a-z]{1,6}-$/.test(prefix), prefix);
    });
  });

  describe('.rootTokens', () => {
    it('is an array of `BearerToken` instances', () => {
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

  describe('getAuthorToken()', () => {
    it('returns a `BearerToken` when given a valid author ID', async () => {
      const t = await Auth.getAuthorToken('some-author');

      assert.instanceOf(t, BearerToken);
    });

    it('should always return a new token even given the same ID', async () => {
      const t1 = await Auth.getAuthorToken('florp');
      const t2 = await Auth.getAuthorToken('florp');

      assert.isFalse(t1.sameToken(t2));
    });

    it('returns a token whose full string conforms to `isToken()`', async () => {
      const t = await Auth.getAuthorToken('some-author');

      assert.isTrue(Auth.isToken(t.secretToken));
    });

    it('returns a token which elicits a correct response from `tokenAuthority()`', async () => {
      const AUTHOR_ID = 'that-author';
      const t         = await Auth.getAuthorToken(AUTHOR_ID);
      const authority = await Auth.tokenAuthority(t);
      const expect    = {
        type:     Auth.TYPE_author,
        authorId: AUTHOR_ID
      };

      assert.deepEqual(authority, expect);
    });
  });

  describe('isToken()', () => {
    it('accepts token syntax', () => {
      assert.isTrue(Auth.isToken(ROOT_TOKEN));

      for (const t of EXAMPLE_TOKENS) {
        assert.isTrue(Auth.isToken(t), t);
      }
    });

    it('rejects non-token syntax', () => {
      assert.isFalse(Auth.isToken('00000000-11234def0'));
      assert.isFalse(Auth.isToken('-0000000-11234def'));
      assert.isFalse(Auth.isToken('z-0000000-1123cdef'));
      assert.isFalse(Auth.isToken('zz-0000000-1123cdef'));
      assert.isFalse(Auth.isToken('zzz-0000000-1123cdef'));
      assert.isFalse(Auth.isToken('zzzz-0000000-1123cdef'));
      assert.isFalse(Auth.isToken('root-0000000-112bcdef-'));
      assert.isFalse(Auth.isToken('root-0000000-11234def-1'));
      assert.isFalse(Auth.isToken('root-z0000000-112bcdef'));
      assert.isFalse(Auth.isToken('root-00000000-11abcdef1'));
      assert.isFalse(Auth.isToken('root-000000001123cdef'));
      assert.isFalse(Auth.isToken('root-1-2'));
    });
  });

  describe('tokenAuthority()', () => {
    it('rejects non-token values', async () => {
      async function test(x) {
        await assert.isRejected(Auth.tokenAuthority(x), /badValue/);
      }

      await test(undefined);
      await test(null);
      await test('florp');
      await test([1, 2]);
      await test(new Map());
      await test(EXAMPLE_TOKENS[0]); // Requires a token object, not a string.
    });

    it('should indicate "no auth" for an unknown token', async () => {
      async function test(t) {
        const token = Auth.tokenFromString(t);
        const auth  = await Auth.tokenAuthority(token);

        assert.deepEqual(auth, { type: Auth.TYPE_none });
      }

      for (const t of EXAMPLE_TOKENS) {
        await test(t);
      }
    });

    it('should indicate "root auth" for the staticly-known root token', async () => {
      const token = Auth.tokenFromString(ROOT_TOKEN);
      const auth  = await Auth.tokenAuthority(token);

      assert.deepEqual(auth, { type: Auth.TYPE_root });
    });
  });

  describe('tokenFromString()', () => {
    it('should construct a token with the expected parts, given a valid token', () => {
      const id    = 'root-01233210';
      const full  = `${id}-aaaaaaa1`;
      const token = Auth.tokenFromString(full);

      assert.strictEqual(token.id, id);
      assert.strictEqual(token.secretToken, full);
    });
  });

  describe('tokenId()', () => {
    it('should extract the ID of a valid token', () => {
      const id    = 'root-01234210';
      const token = `${id}-bbbbbbbb`;
      assert.strictEqual(Auth.tokenId(token), id);
    });
  });
});
