// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseKey } from 'api-common';
import { Random } from 'util-common';

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

describe('api-common/BaseKey', () => {
  describe('constructor', () => {
    it('should throw an error given a URL with auth', () => {
      assert.throws(() => new BaseKey('http://foo@example.com/', VALID_ID));
      assert.throws(() => new BaseKey('http://foo:blort@example.com/', VALID_ID));
    });

    it('should throw an error given an invalid absolute URL', () => {
      assert.throws(() => new BaseKey('http:foo.com/', VALID_ID));
      assert.throws(() => new BaseKey('https://blort.com', VALID_ID)); // Needs a final slash.
    });
  });

  describe('.url', () => {
    it('should return the URL passed to the constructor', () => {
      function test(url) {
        assert.strictEqual(new BaseKey(url, VALID_ID).url, url, url);
      }

      test('*');
      test('http://foo.bar/');
      test('http://florp.example.com/api');
    });
  });

  describe('.baseUrl', () => {
    it('should throw an error for URL `*`', () => {
      assert.throws(() => new BaseKey('*', VALID_ID).baseUrl);
    });

    it('should return the base URL of the originally-passed URL', () => {
      // This uses a regex to chop up the URL. The actual implementation uses
      // the URL class. To the extent that they differ, the regex is probably
      // wrong.
      let which = 0;
      function test(orig) {
        const key = new BaseKey(orig, VALID_ID);
        const expected = orig.match(/^[^:]+:\/\/[^/]+/)[0];

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

      test('https://example.com/?what=does&this=mean');
      test('https://example.com/foo/bar?what=does&this=mean');
      test('https://example.com/#hashie');
      test('https://example.com/foo/bar#hashie');
    });
  });

  describe('.id', () => {
    it('should return the ID passed to the constructor', () => {
      const id  = 'this-is-an-id';
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
      const key = new FakeKey('*', VALID_ID);
      const pair = key.makeChallengePair();

      assert.property(pair, 'challenge');
      assert.property(pair, 'response');
    });
  });
});
