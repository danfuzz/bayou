// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { SplitKey } from 'api-common';

const FAKE_KEY = '0011223344556677';
const FAKE_SECRET = '00112233445566778899aabbccddeeff';

describe('api-common/SplitKey', () => {
  describe('constructor', () => {
    it('should reject non-string urls', () => {
      assert.throws(() => new SplitKey(37, FAKE_KEY, FAKE_SECRET));
    });

    it('should reject non-hex keys', () => {
      assert.throws(() => new SplitKey('https://www.example.com/', 'this better not work!', FAKE_SECRET));
    });

    it('should reject non-hex secrets', () => {
      assert.throws(() => new SplitKey('https://www.example.com/', FAKE_KEY, 'this better not work!'));
    });

    it('should return a frozen instance of SplitKey when given 2 valid parameters', () => {
      let key = null;

      assert.doesNotThrow(() => {
        key = new SplitKey('https://www.example.com/api', FAKE_KEY);
      });

      assert.instanceOf(key, SplitKey);
      assert.isFrozen(key);
    });

    it('should return a frozen instance of SplitKey when given 3 valid parameters', () => {
      let key = null;

      assert.doesNotThrow(() => {
        key = new SplitKey('https://www.example.com/', FAKE_KEY, FAKE_SECRET);
      });

      assert.instanceOf(key, SplitKey);
      assert.isFrozen(key);
    });
  });

  describe('_impl methods', () => {
    it('should should have some way to be tested');
  });
});
