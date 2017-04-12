// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { beforeEach, describe, it } from 'mocha';

import { BaseKey } from 'api-common';
import { DataUtil, Random } from 'util-common';

let key = null;

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

beforeEach(() => {
  key = new FakeKey(URL, ID);
});

describe('api-common.BaseKey', () => {
  describe('.url', () => {
    it('should return the URL passed to the constructor', () => {
      const url = key.url;

      assert.equal(url, URL);
    });
  });

  describe('.id', () => {
    it('should return the ID passed to the constructor', () => {
      const id = key.id;

      assert.equal(id, ID);
    });
  });

  describe('#toString()', () => {
    it('returns a redacted (log-safe) representation of the key', () => {
      const s = key.toString();

      assert.isString(s);
    });
  });

  describe('#makeChallengePair()', () => {
    it('returns a challenge/response pair in an object', () => {
      const pair = key.makeChallengePair();

      assert.property(pair, 'challenge');
      assert.property(pair, 'response');
    });
  });
});
