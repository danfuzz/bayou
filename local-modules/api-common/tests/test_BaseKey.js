// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseKey } from 'api-common';
import { DataUtil, Random } from 'util-common';

const URL = '*';
const ID = '12345678';

class FakeKey extends BaseKey {
  _impl_randomChallengeString() {
    return Random.hexByteString(16);
  }

  _impl_challengeResponseFor(challenge) {
    const bytes = DataUtil.bytesFromHex(challenge);
    const newBytes = [];

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];

      newBytes[i] = byte ^ 0x0e;
    }

    return DataUtil.hexFromBytes(newBytes);
  }
}

describe('api-common/BaseKey', () => {
  describe('.url', () => {
    it('should return the URL passed to the constructor', () => {
      const key = new BaseKey(URL, ID);
      const url = key.url;

      assert.strictEqual(url, URL);
    });
  });

  describe('.baseUrl', () => {
    it('should throw an error for URL `*`', () => {
      assert.throws(() => new BaseKey('*', ID).baseUrl);
    });

    it('should return the base URL of the originally-passed URL', () => {
      // This uses a regex to chop up the URL. The actual implementation uses
      // the URL class. To the extent that they differ, the regex is probably
      // wrong.
      let which = 0;
      function test(orig) {
        const key = new BaseKey(orig, ID);
        const expected = orig.match(/^[^:]+:\/\/[^/]+/)[0];

        which++;
        assert.strictEqual(key.baseUrl, expected, `#${which}`);
      }

      test('https://x');
      test('https://x.y');
      test('https://x.y/');
      test('https://x.y/a');
      test('https://x.y:37/');
      test('https://x.y:123/b');
      test('https://florp@x.y:914/');
      test('https://florp@x.y:667/c');
      test('https://florp:like@x.y:23/');
      test('https://florp:like@x.y:242/d');

      test('https://example.com/?what=does&this=mean');
      test('https://example.com/foo/bar?what=does&this=mean');
      test('https://example.com/#hashie');
      test('https://example.com/foo/bar#hashie');
    });
  });

  describe('.id', () => {
    it('should return the ID passed to the constructor', () => {
      const key = new FakeKey(URL, ID);
      const id = key.id;

      assert.strictEqual(id, ID);
    });
  });

  describe('toString()', () => {
    it('returns a redacted (log-safe) representation of the key', () => {
      const key = new FakeKey(URL, ID);
      const s = key.toString();

      assert.isString(s);
    });
  });

  describe('makeChallengePair()', () => {
    it('returns a challenge/response pair in an object', () => {
      const key = new FakeKey(URL, ID);
      const pair = key.makeChallengePair();

      assert.property(pair, 'challenge');
      assert.property(pair, 'response');
    });
  });
});
