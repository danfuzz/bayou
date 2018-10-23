// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseKey } from '@bayou/api-common';
import { Random } from '@bayou/util-common';

const VALID_ID = '12345678';

class FakeKey extends BaseKey {
  _impl_randomChallengeString() {
    return Random.hexByteString(16);
  }

  _impl_challengeResponseFor(challenge) {
    const bytes = Buffer.from(challenge, 'hex');

    for (let i = 0; i < bytes.length; i++) {
      bytes[i] ^= 0x0e;
    }

    return bytes.toString('hex');
  }
}

describe('@bayou/api-common/BaseKey', () => {
  describe('redactString()', () => {
    it('fully redacts strings of length 11 or shorter', () => {
      const FULL_STRING   = '1234567890x';
      const EXPECT_STRING = '...';

      for (let i = 0; i < FULL_STRING.length; i++) {
        assert.strictEqual(BaseKey.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });

    it('drops all but the first 8 characters of strings of length 12 through 23', () => {
      const FULL_STRING   = '1234567890abcdefghijklm';
      const EXPECT_STRING = '12345678...';

      for (let i = 12; i < FULL_STRING.length; i++) {
        assert.strictEqual(BaseKey.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });

    it('drops all but the first 16 characters of strings of length 24 or greater', () => {
      const FULL_STRING   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz';
      const EXPECT_STRING = 'ABCDEFGHIJKLMNOP...';

      for (let i = 24; i < FULL_STRING.length; i++) {
        assert.strictEqual(BaseKey.redactString(FULL_STRING.slice(0, i)), EXPECT_STRING, `length ${i}`);
      }
    });
  });

  describe('constructor', () => {
    it('accepts `*` as the URL', () => {
      assert.doesNotThrow(() => new BaseKey('*', VALID_ID));
    });

    it('accepts an absoulute URL', () => {
      assert.doesNotThrow(() => new BaseKey('http://foo.com/', VALID_ID));
      assert.doesNotThrow(() => new BaseKey('https://foo.com/', VALID_ID));
      assert.doesNotThrow(() => new BaseKey('https://bar.org/x', VALID_ID));
      assert.doesNotThrow(() => new BaseKey('https://bar.org/x/', VALID_ID));
      assert.doesNotThrow(() => new BaseKey('https://bar.org/x/a%20b', VALID_ID));
    });

    it('rejects a non-absolute URL', () => {
      function test(value) {
        assert.throws(() => new BaseKey(value, VALID_ID));
      }

      test('http://foo@example.com/');
      test('http://foo:blort@example.com/');
      test('https://example.com/?a');
      test('https://example.com/?a=10');
      test('https://example.com/x?a');
      test('https://example.com/florp?a=10');
      test('https://example.com/bip/bop/?a');
      test('https://example.com/florp/like/?a=10');
      test('https://example.com/#');
      test('https://example.com/#hashie');
      test('https://example.com/a#hashie');
      test('https://example.com/a/#hashie');
      test('https://example.com/a/nother/#hashie');
    });

    it('rejects an invalid absolute URL', () => {
      assert.throws(() => new BaseKey('http:foo.com/', VALID_ID));
      assert.throws(() => new BaseKey('https://blort.com', VALID_ID)); // Needs a final slash.
    });

    it('rejects an invalid ID', () => {
      assert.throws(() => new BaseKey('http://foo.com/', ''), /badValue/);
      assert.throws(() => new BaseKey('http://foo.com/', '!'), /badValue/);
      assert.throws(() => new BaseKey('http://foo.com/', null), /badValue/);
      assert.throws(() => new BaseKey('http://foo.com/', 123), /badValue/);
    });
  });

  describe('.url', () => {
    it('is the URL passed to the constructor', () => {
      function test(url) {
        assert.strictEqual(new BaseKey(url, VALID_ID).url, url, url);
      }

      test('*');
      test('http://foo.bar/');
      test('http://florp.example.com/api');
    });
  });

  describe('.baseUrl', () => {
    it('throws if `.url` is `*`', () => {
      assert.throws(() => new BaseKey('*', VALID_ID).baseUrl);
    });

    it('is the base URL of the originally-passed URL', () => {
      // This uses a regex to chop up the URL. The actual implementation uses
      // the URL class. To the extent that they differ, the regex is probably
      // wrong.
      let which = 0;
      function test(orig) {
        const key = new BaseKey(orig, VALID_ID);
        const expected = orig.match(/^[^:]+:[/][/][^/]+/)[0];

        which++;
        assert.strictEqual(key.baseUrl, expected, `#${which}`);
      }

      test('https://x/');
      test('https://x.y/');
      test('https://x.y/a');
      test('https://x.y/a/b/c');
      test('https://x.y:37/');
      test('https://x.y:123/b');
      test('https://x.y.z/aa/bb/cc/');
    });
  });

  describe('.id', () => {
    it('is the ID passed to the constructor', () => {
      const id  = 'this_is_an_id';
      const key = new BaseKey('*', id);

      assert.strictEqual(key.id, id);
    });
  });

  describe('toString()', () => {
    it('returns a string', () => {
      const key = new BaseKey('*', VALID_ID);

      assert.isString(key.toString());
    });
  });

  describe('makeChallengePair()', () => {
    it('returns a challenge/response pair in an object', () => {
      const key  = new FakeKey('*', VALID_ID);
      const pair = key.makeChallengePair();

      assert.isObject(pair);
      assert.property(pair, 'challenge');
      assert.property(pair, 'response');
    });
  });
});
