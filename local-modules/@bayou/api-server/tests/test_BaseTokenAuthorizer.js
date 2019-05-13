// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { BaseTokenAuthorizer } from '@bayou/api-server';

describe('@bayou/api-server/BaseTokenAuthorizer', () => {
  describe('.nonTokenPrefix', () => {
    it('calls through to the `_impl`', () => {
      class Authie extends BaseTokenAuthorizer {
        get _impl_nonTokenPrefix() {
          return 'foomp';
        }
      }

      assert.strictEqual(new Authie().nonTokenPrefix, 'foomp');
    });

    it('rejects a bad subclass implementation', () => {
      class Authie extends BaseTokenAuthorizer {
        get _impl_nonTokenPrefix() {
          return ['not just a string'];
        }
      }

      assert.throws(() => new Authie().nonTokenPrefix, /badValue/);
    });
  });

  describe('cookieNamesForToken()', () => {
    it('calls through to the `_impl` given a `BearerToken`', async () => {
      class Authie extends BaseTokenAuthorizer {
        async _impl_cookieNamesForToken(value) {
          return [value.secretToken, 'florp'];
        }
      }

      const au     = new Authie();
      const token  = new BearerToken('x', 'xyzpdq');
      const result = await au.cookieNamesForToken(token);

      assert.deepEqual(result, [token.secretToken, 'florp']);
    });

    it('rejects a non-`BearerToken` argument', async () => {
      class Authie extends BaseTokenAuthorizer {
        async _impl_cookieNamesForToken(value_unused) {
          throw new Error('unexpected');
        }
      }

      const au = new Authie();

      async function test(v) {
        await assert.isRejected(au.cookieNamesForToken(v), /badValue/);
      }

      await test(undefined);
      await test(null);
      await test('florp');
      await test([1, 2, 3]);
    });
  });

  describe('getAuthorizedTarget()', () => {
    it('calls through to the `_impl` given a `BearerToken`', async () => {
      class Authie extends BaseTokenAuthorizer {
        async _impl_getAuthorizedTarget(value) {
          return { got: value };
        }
      }

      const au     = new Authie();
      const token  = new BearerToken('x', 'y');
      const result = await au.getAuthorizedTarget(token);

      assert.deepEqual(result, { got: token });
    });

    it('converts a string to a `BearerToken` then through to the `_impl`', async () => {
      class Authie extends BaseTokenAuthorizer {
        async _impl_getAuthorizedTarget(value) {
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
      const result = await au.getAuthorizedTarget('yes');

      assert.deepEqual(result, { got: new BearerToken('yes', 'yes') });
    });

    it('rejects a non-string non-`BearerToken` argument without calling through to the `_impl`', async () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_getAuthorizedTarget(value_unused) {
          throw new Error('Should not have been called.');
        }
      }

      const au = new Authie();

      await assert.isRejected(au.getAuthorizedTarget(undefined), /badValue/);
      await assert.isRejected(au.getAuthorizedTarget(null), /badValue/);
      await assert.isRejected(au.getAuthorizedTarget(true), /badValue/);
      await assert.isRejected(au.getAuthorizedTarget(914), /badValue/);
      await assert.isRejected(au.getAuthorizedTarget(['foo']), /badValue/);
    });

    it('accepts `null` from the `_impl`', async () => {
      class Authie extends BaseTokenAuthorizer {
        async _impl_getAuthorizedTarget(value_unused) {
          return null;
        }
      }

      const au     = new Authie();
      const result = await au.getAuthorizedTarget(new BearerToken('x', 'y'));

      assert.isNull(result);
    });

    it('rejects a bad subclass implementation', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_getAuthorizedTarget(value_unused) {
          // Supposed to be an object or `null`.
          return 123;
        }
      }

      const token = new BearerToken('x', 'y');

      assert.isRejected(new Authie().getAuthorizedTarget(token), /badValue/);
    });
  });

  describe('isToken()', () => {
    it('calls through to the `_impl` given a string', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value) {
          return value.startsWith('token-');
        }
      }

      const au = new Authie();

      assert.isTrue(au.isToken('token-yes'));
      assert.isFalse(au.isToken('not-a-token'));
    });

    it('rejects a non-string without calling through to the `_impl`', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value_unused) {
          throw new Error('Should not have been called.');
        }
      }

      const au = new Authie();

      assert.throws(() => au.isToken(null), /badValue/);
      assert.throws(() => au.isToken(123), /badValue/);
      assert.throws(() => au.isToken(['x']), /badValue/);
    });

    it('rejects a bad subclass implementation', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value_unused) {
          return 'this is not a boolean';
        }
      }

      assert.throws(() => new Authie().isToken('x'), /badValue/);
    });
  });

  describe('tokenFromString()', () => {
    it('validates via `isToken()` given a string, and calls through to the `_impl`', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value) {
          return value.startsWith('token-');
        }

        _impl_tokenFromString(value) {
          return new BearerToken(value, value);
        }
      }

      const au   = new Authie();
      const tstr = 'token-yes-it-is';

      assert.deepEqual(au.tokenFromString(tstr), new BearerToken(tstr, tstr));
      assert.throws(() => au.tokenFromString('nope'), /badValue/);
    });

    it('rejects a non-string without calling through to any `_impl`', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value_unused) {
          throw new Error('Should not have been called.');
        }

        _impl_tokenFromString(value_unused) {
          throw new Error('Should not have been called.');
        }
      }

      const au = new Authie();

      assert.throws(() => au.tokenFromString(null), /badValue/);
      assert.throws(() => au.tokenFromString(123), /badValue/);
      assert.throws(() => au.tokenFromString(['x']), /badValue/);
    });

    it('rejects a bad subclass implementation', () => {
      class Authie extends BaseTokenAuthorizer {
        _impl_isToken(value_unused) {
          return true;
        }

        _impl_tokenFromString(value_unused) {
          return 'not a BearerToken';
        }
      }

      assert.throws(() => new Authie().tokenFromString('x'), /badValue/);
    });
  });
});
