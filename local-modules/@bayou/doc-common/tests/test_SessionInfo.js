// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { SessionInfo } from '@bayou/doc-common';

/** {string} Handy origin-only URL. */
const ORIGIN_URL = 'https://example.com';

describe('@bayou/doc-common/SessionInfo', () => {
  describe('constructor()', () => {
    it('should accept four strings', () => {
      // **TODO:** Will have to be updated when validation is improved. Likewise
      // throughout the file.
      const result = new SessionInfo(ORIGIN_URL, 'one', 'two', 'three');
      assert.isFrozen(result);
    });

    it('should accept three strings', () => {
      const result = new SessionInfo(ORIGIN_URL, 'one', 'two');
      assert.isFrozen(result);
    });

    it('should accept three strings and `null`', () => {
      const result = new SessionInfo(ORIGIN_URL, 'one', 'two', null);
      assert.isFrozen(result);
    });

    it('should reject invalid arguments', () => {
      function test(...args) {
        assert.throws(() => new SessionInfo(...args));
      }

      test('',                   'x', 'y', 'z');
      test('not-a-url',          'x', 'y', 'z');
      test('http://x.com/stuff', 'x', 'y', 'z'); // Not origin-only.

      test(ORIGIN_URL, null, 'x', 'y');
      test(ORIGIN_URL, 123,  'x', 'y');
      test(ORIGIN_URL, [],   'x', 'y');

      test(ORIGIN_URL, 'token', null,      'y');
      test(ORIGIN_URL, 'token', false,     'y');
      test(ORIGIN_URL, 'token', { x: 10 }, 'y');

      test(ORIGIN_URL, 'token', 'x', true);
      test(ORIGIN_URL, 'token', 'x', new Set());
    });
  });

  describe('.authorToken', () => {
    it('should be the constructed value', () => {
      const token  = 'florp';
      const result = new SessionInfo(ORIGIN_URL, token, 'x');
      assert.strictEqual(result.authorToken, token);
    });
  });

  describe('.documentId', () => {
    it('should be the constructed value', () => {
      const id     = 'blort';
      const result = new SessionInfo(ORIGIN_URL, 'token', id);
      assert.strictEqual(result.documentId, id);
    });
  });

  describe('.serverUrl', () => {
    it('should be the constructed value', () => {
      const url    = 'https://milk.com:1231';
      const result = new SessionInfo(url, 'token', 'x');
      assert.strictEqual(result.serverUrl, url);
    });
  });

  describe('.caretId', () => {
    it('should be the constructed value', () => {
      const id     = 'zorch';
      const result = new SessionInfo(ORIGIN_URL, 'token', 'doc', id);
      assert.strictEqual(result.caretId, id);
    });

    it('should be `null` if not passed in the constructor', () => {
      const result = new SessionInfo(ORIGIN_URL, 'token', 'doc');
      assert.isNull(result.caretId);
    });
  });

  describe('.logTag', () => {
    it('should be the `caretId` if non-`null`', () => {
      const id = 'caretness';
      const si = new SessionInfo(ORIGIN_URL, 'token', 'doc', id);
      assert.strictEqual(si.logTag, id);
    });

    it('should be the `documentId` if `caretId === null`', () => {
      const id = 'docness';
      const si = new SessionInfo(ORIGIN_URL, 'token', id);
      assert.strictEqual(si.logTag, id);
    });
  });

  describe('deconstruct()', () => {
    it('should return a three-element array when constructed with three arguments', () => {
      const si     = new SessionInfo(ORIGIN_URL, 'token', 'id');
      const result = si.deconstruct();

      assert.deepEqual(result, [ORIGIN_URL, 'token', 'id']);
    });

    it('should return a four-element array when constructed with four non-`null` arguments', () => {
      const si     = new SessionInfo(ORIGIN_URL, 'token', 'id', 'c');
      const result = si.deconstruct();

      assert.deepEqual(result, [ORIGIN_URL, 'token', 'id', 'c']);
    });
  });
});
