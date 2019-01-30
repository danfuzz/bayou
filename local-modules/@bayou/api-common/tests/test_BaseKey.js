// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseKey } from '@bayou/api-common';
import { TString } from '@bayou/typecheck';

const VALID_ID = '12345678';

describe('@bayou/api-common/BaseKey', () => {
  describe('constructor', () => {
    it('rejects an invalid ID', () => {
      assert.throws(() => new BaseKey(''), /badValue/);
      assert.throws(() => new BaseKey('!'), /badValue/);
      assert.throws(() => new BaseKey(null), /badValue/);
      assert.throws(() => new BaseKey(123), /badValue/);
    });
  });

  describe('.id', () => {
    it('is the ID passed to the constructor', () => {
      const id  = 'this_is_an_id';
      const key = new BaseKey(id);

      assert.strictEqual(key.id, id);
    });
  });

  describe('.safeString', () => {
    it('calls through to the `_impl`', () => {
      class SomeKey extends BaseKey {
        _impl_safeString() {
          return 'hello!';
        }
      }

      const result = new SomeKey(VALID_ID).safeString;
      assert.strictEqual(result, 'hello!');
    });

    it('rejects an invalid subclass implementation', () => {
      class SomeKey extends BaseKey {
        _impl_safeString() {
          return 123; // Supposed to be a string.
        }
      }

      const key = new SomeKey(VALID_ID);

      assert.throws(() => key.safeString, /badValue/);
    });
  });

  describe('toString()', () => {
    it('returns a string', () => {
      const key = new BaseKey(VALID_ID);

      assert.isString(key.toString());
    });

    it('returns a string that contains the ID', () => {
      function test(id) {
        const key    = new BaseKey(id);
        const result = key.toString();

        assert.isTrue(result.indexOf(id) >= 0, id);
      }

      test('x');
      test('123-florp');
      test('a');
      test('like');
    });
  });

  describe('makeChallengePair()', () => {
    it('returns a challenge/response pair in an object', () => {
      class FakeKey extends BaseKey {
        _impl_challengeSecret() {
          return '0123456789abcdef';
        }
      }

      const key  = new FakeKey(VALID_ID);
      const pair = key.makeChallengePair();

      assert.isObject(pair);
      assert.hasAllKeys(pair, ['challenge', 'response']);
      assert.isString(pair.challenge);
      assert.isString(pair.response);
      assert.doesNotThrow(() => TString.hexBytes(pair.challenge, 8, 8));
      assert.doesNotThrow(() => TString.hexBytes(pair.response, 32, 32));
    });
  });
});
