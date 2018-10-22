// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { TokenAuthorizer } from '@bayou/api-server';

describe('@bayou/api-server/TokenAuthorizer', () => {
  describe('.nonTokenPrefix', () => {
    it('should call through to the `_impl`', () => {
      class Authie extends TokenAuthorizer {
        get _impl_nonTokenPrefix() {
          return 'foomp';
        }
      }

      assert.strictEqual(new Authie().nonTokenPrefix, 'foomp');
    });

    it('should reject a bad subclass implementation', () => {
      class Authie extends TokenAuthorizer {
        get _impl_nonTokenPrefix() {
          return ['not just a string'];
        }
      }

      assert.throws(() => new Authie().nonTokenPrefix, /badValue/);
    });
  });

  describe('isToken()', () => {
    it('should call through to the `_impl` given a string', () => {
      class Authie extends TokenAuthorizer {
        _impl_isToken(value) {
          return value.startsWith('token-');
        }
      }

      const au = new Authie();

      assert.isTrue(au.isToken('token-yes'));
      assert.isFalse(au.isToken('not-a-token'));
    });

    it('should reject a non-string without calling through to the `_impl`', () => {
      class Authie extends TokenAuthorizer {
        _impl_isToken(value_unused) {
          throw new Error('Should not have been called.');
        }
      }

      const au = new Authie();

      assert.throws(() => au.isToken(null), /badValue/);
      assert.throws(() => au.isToken(123), /badValue/);
      assert.throws(() => au.isToken(['x']), /badValue/);
    });

    it('should reject a bad subclass implementation', () => {
      class Authie extends TokenAuthorizer {
        _impl_isToken(value_unused) {
          return 'this is not a boolean';
        }
      }

      assert.throws(() => new Authie().isToken('x'), /badValue/);
    });
  });

  describe('targetFromToken()', () => {
    it('should call through to the `_impl` given a `BearerToken`', async () => {
      class Authie extends TokenAuthorizer {
        async _impl_targetFromToken(value) {
          return { got: value };
        }
      }

      const au     = new Authie();
      const token  = new BearerToken('x', 'y');
      const result = await au.targetFromToken(token);

      assert.deepEqual(result, { got: token });
    });

    it('should convert a string to a `BearerToken` then through to the `_impl`', async () => {
      class Authie extends TokenAuthorizer {
        async _impl_targetFromToken(value) {
          return { got: value };
        }

        _impl_tokenFromString(value) {
          return new BearerToken(value, value);
        }

        _impl_isToken(value_unused) {
          return true;
        }
      }

      const au     = new Authie();
      const result = await au.targetFromToken('yes');

      assert.deepEqual(result, { got: new BearerToken('yes', 'yes') });
    });

    it('should reject a non-string non-`BearerToken` argument without calling through to the `_impl`', async () => {
      class Authie extends TokenAuthorizer {
        _impl_targetFromToken(value_unused) {
          throw new Error('Should not have been called.');
        }
      }

      const au = new Authie();

      await assert.isRejected(au.targetFromToken(undefined), /badValue/);
      await assert.isRejected(au.targetFromToken(null), /badValue/);
      await assert.isRejected(au.targetFromToken(true), /badValue/);
      await assert.isRejected(au.targetFromToken(914), /badValue/);
      await assert.isRejected(au.targetFromToken(['foo']), /badValue/);
    });

    it('should accept `null` from the `_impl`', async () => {
      class Authie extends TokenAuthorizer {
        async _impl_targetFromToken(value_unused) {
          return null;
        }
      }

      const au     = new Authie();
      const result = await au.targetFromToken(new BearerToken('x', 'y'));

      assert.isNull(result);
    });

    it('should reject a bad subclass implementation', () => {
      class Authie extends TokenAuthorizer {
        _impl_targetFromToken(value_unused) {
          // Supposed to be an object or `null`.
          return 123;
        }
      }

      const token = new BearerToken('x', 'y');

      assert.isRejected(new Authie().targetFromToken(token), /badValue/);
    });
  });
});
