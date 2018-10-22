// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

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
        get _impl_nonTokenPrefix() {
          return ['not just a string'];
        }
      }

      assert.throws(() => new Authie().nonTokenPrefix, /badValue/);
    });
  });
});
