// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BearerToken } from '@bayou/api-common';
import { SessionInfo } from '@bayou/doc-common';

/** {string} Handy valid server URL. */
const SERVER_URL = 'https://example.com:1234/the/path';

describe('@bayou/doc-common/SessionInfo', () => {
  describe('constructor()', () => {
    it('should accept four strings', () => {
      // **TODO:** Will have to be updated when validation is improved. Likewise
      // throughout the file.
      const result = new SessionInfo(SERVER_URL, 'one', 'two', 'three');
      assert.isFrozen(result);
    });

    it('should accept three strings', () => {
      const result = new SessionInfo(SERVER_URL, 'one', 'two');
      assert.isFrozen(result);
    });

    it('should accept three strings and `null`', () => {
      const result = new SessionInfo(SERVER_URL, 'one', 'two', null);
      assert.isFrozen(result);
    });

    it('should accept a `BearerToken` for the `authorToken` argument', () => {
      const token  = new BearerToken('x', 'y');
      const result = new SessionInfo(SERVER_URL, token, 'boop');
      assert.isFrozen(result);
    });

    it('should reject invalid arguments', () => {
      function test(...args) {
        assert.throws(() => new SessionInfo(...args));
      }

      test('',                  'x', 'y', 'z');
      test('not-a-real-url',    'x', 'y', 'z');
      test('/stuff/etc',        'x', 'y', 'z');
      test('//milk.com/stuff',  'x', 'y', 'z');
      test('http//x.com/stuff', 'x', 'y', 'z');
      test('http://milk.com',   'x', 'y', 'z'); // Needs to have a path, even if just `/`.

      test(SERVER_URL, null, 'x', 'y');
      test(SERVER_URL, 123,  'x', 'y');
      test(SERVER_URL, [],   'x', 'y');

      test(SERVER_URL, 'token', null,      'y');
      test(SERVER_URL, 'token', false,     'y');
      test(SERVER_URL, 'token', { x: 10 }, 'y');

      test(SERVER_URL, 'token', 'x', true);
      test(SERVER_URL, 'token', 'x', new Set());
    });
  });

  describe('.authorToken', () => {
    it('should be the constructed value if constructed from a string', () => {
      const token  = 'florp';
      const result = new SessionInfo(SERVER_URL, token, 'x');
      assert.strictEqual(result.authorToken, token);
    });

    it('should be the `secretToken` from a `BearerToken` if that was used in construction', () => {
      const secret = 'the-secret';
      const token  = new BearerToken('the-id', secret);
      const result = new SessionInfo(SERVER_URL, token, 'boop');
      assert.strictEqual(result.authorToken, secret);
    });
  });

  describe('.documentId', () => {
    it('should be the constructed value', () => {
      const id     = 'blort';
      const result = new SessionInfo(SERVER_URL, 'token', id);
      assert.strictEqual(result.documentId, id);
    });
  });

  describe('.serverUrl', () => {
    it('should be the constructed value', () => {
      const url    = 'https://milk.com:1234/florp';
      const result = new SessionInfo(url, 'token', 'x');
      assert.strictEqual(result.serverUrl, url);
    });
  });

  describe('.caretId', () => {
    it('should be the constructed value', () => {
      const id     = 'zorch';
      const result = new SessionInfo(SERVER_URL, 'token', 'doc', id);
      assert.strictEqual(result.caretId, id);
    });

    it('should be `null` if not passed in the constructor', () => {
      const result = new SessionInfo(SERVER_URL, 'token', 'doc');
      assert.isNull(result.caretId);
    });
  });

  describe('.logTag', () => {
    it('should be the `caretId` if non-`null`', () => {
      const id = 'caretness';
      const si = new SessionInfo(SERVER_URL, 'token', 'doc', id);
      assert.strictEqual(si.logTag, id);
    });

    it('should be the `documentId` if `caretId === null`', () => {
      const id = 'docness';
      const si = new SessionInfo(SERVER_URL, 'token', id);
      assert.strictEqual(si.logTag, id);
    });
  });

  describe('deconstruct()', () => {
    it('should return a three-element array when constructed with three arguments', () => {
      const si     = new SessionInfo(SERVER_URL, 'token', 'id');
      const result = si.deconstruct();

      assert.deepEqual(result, [SERVER_URL, 'token', 'id']);
    });

    it('should return a four-element array when constructed with four non-`null` arguments', () => {
      const si     = new SessionInfo(SERVER_URL, 'token', 'id', 'c');
      const result = si.deconstruct();

      assert.deepEqual(result, [SERVER_URL, 'token', 'id', 'c']);
    });
  });

  describe('withCaretId', () => {
    it('should return a new instance given a valid `caretId`', () => {
      const orig1 = new SessionInfo(SERVER_URL, 'token', 'doc', 'caret-1');
      const orig2 = new SessionInfo(`${SERVER_URL}/123`, 'also-token', 'docky');

      function test(c) {
        const result1 = orig1.withCaretId(c);
        const expect1 = new SessionInfo(orig1.serverUrl, orig1.authorToken, orig1.documentId, c);
        assert.deepEqual(result1, expect1);

        const result2 = orig2.withCaretId(c);
        const expect2 = new SessionInfo(orig2.serverUrl, orig2.authorToken, orig2.documentId, c);
        assert.deepEqual(result2, expect2);
      }

      test('beep');
      test('boop');
    });

    it('should reject invalid IDs', () => {
      const si = new SessionInfo(SERVER_URL, 'token', 'doc');

      function test(value) {
        assert.throws(() => si.withCaretId(value), /badValue/);
      }

      test(undefined);
      test(null);
      test(914);
      test(['x']);
    });
  });

  describe('withoutCaretId', () => {
    it('should return a new instance with `caretId === null`', () => {
      function test(orig) {
        const result = orig.withoutCaretId();
        const expect = new SessionInfo(orig.serverUrl, orig.authorToken, orig.documentId);

        assert.isNull(result.caretId);
        assert.deepEqual(result, expect);
      }

      test(new SessionInfo(SERVER_URL, 'a', 'b', 'c'));
      test(new SessionInfo(`${SERVER_URL}/123`, 'd', 'e'));
    });
  });
});
