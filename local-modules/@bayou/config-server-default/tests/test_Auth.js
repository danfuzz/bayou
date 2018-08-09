// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Auth } from '@bayou/config-server-default';

describe('@bayou/config-server-default/Auth', () => {
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
