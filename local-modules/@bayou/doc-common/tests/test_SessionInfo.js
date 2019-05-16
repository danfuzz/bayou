// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
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
    it('accepts four strings', () => {
      // **TODO:** Will have to be updated when validation is improved. Likewise
      // throughout the file.
      const result = new SessionInfo(SERVER_URL, 'one', 'two', 'three');
      assert.isFrozen(result);
    });

    it('accepts three strings', () => {
      const result = new SessionInfo(SERVER_URL, 'one', 'two');
      assert.isFrozen(result);
    });

    it('accepts three strings and `null`', () => {
      const result = new SessionInfo(SERVER_URL, 'one', 'two', null);
      assert.isFrozen(result);
    });

    it('accepts a `BearerToken` for the `authorToken` argument', () => {
      const token  = new BearerToken('x', 'y');
      const result = new SessionInfo(SERVER_URL, token, 'boop');
      assert.isFrozen(result);
    });

    it('rejects invalid arguments', () => {
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

  describe('.apiUrl', () => {
    it('is the constructed value', () => {
      const url    = 'https://milk.com:1234/florp';
      const result = new SessionInfo(url, 'token', 'x');
      assert.strictEqual(result.apiUrl, url);
    });
  });

  describe('.authorToken', () => {
    it('is the constructed value if constructed from a string', () => {
      const token  = 'florp';
      const result = new SessionInfo(SERVER_URL, token, 'x');
      assert.strictEqual(result.authorToken, token);
    });

    it('is the constructed value if constructed from a `BearerToken`', () => {
      const token  = new BearerToken('the-id', 'the-secret');
      const result = new SessionInfo(SERVER_URL, token, 'boop');
      assert.strictEqual(result.authorToken, token);
    });
  });

  describe('.documentId', () => {
    it('is the constructed value', () => {
      const id     = 'blort';
      const result = new SessionInfo(SERVER_URL, 'token', id);
      assert.strictEqual(result.documentId, id);
    });
  });

  describe('.serverUrl', () => {
    it('is the constructed `apiUrl` value', () => {
      const url    = 'https://milk.com:1234/florp';
      const result = new SessionInfo(url, 'token', 'x');
      assert.strictEqual(result.serverUrl, url);
    });
  });

  describe('.caretId', () => {
    it('is the constructed value', () => {
      const id     = 'zorch';
      const result = new SessionInfo(SERVER_URL, 'token', 'doc', id);
      assert.strictEqual(result.caretId, id);
    });

    it('is `null` if not passed in the constructor', () => {
      const result = new SessionInfo(SERVER_URL, 'token', 'doc');
      assert.isNull(result.caretId);
    });
  });

  describe('.logInfo', () => {
    it('reflects the constructed `apiUrl`', () => {
      const si   = new SessionInfo(SERVER_URL, 'token', 'doc');
      const info = si.logInfo;

      assert.strictEqual(info.apiUrl, si.apiUrl);
    });

    it('reflects the constructed `documentId`', () => {
      const si   = new SessionInfo(SERVER_URL, 'token', 'doc');
      const info = si.logInfo;

      assert.strictEqual(info.documentId, si.documentId);
    });

    it('reflects the constructed `caretId` if present', () => {
      const si   = new SessionInfo(SERVER_URL, 'token', 'doc', 'the-present-id');
      const info = si.logInfo;

      assert.strictEqual(info.caretId, si.caretId);
    });

    it('does not bind `caretId` if the instance has no `caretId`', () => {
      const si   = new SessionInfo(SERVER_URL, 'token', 'doc');
      const info = si.logInfo;

      assert.doesNotHaveAnyKeys(info, { caretId: null });
    });

    it('includes a redacted form of `authorToken` if it is a string', () => {
      const si   = new SessionInfo(SERVER_URL, 'token-token-whee-whee-whee-whee', 'doc');
      const info = si.logInfo;

      assert.strictEqual(info.authorToken, 'token-token-whee...');
    });

    it('includes the `safeString` of `authorToken` if it is a `BearerToken`', () => {
      const token = new BearerToken('token-id', 'the-full-secret');
      const si    = new SessionInfo(SERVER_URL, token, 'doc');
      const info  = si.logInfo;

      assert.strictEqual(info.authorToken, token.safeString);
    });
  });

  describe('.logTags', () => {
    it('includes the `caretId` if non-`null`', () => {
      const did = 'docness';
      const cid = 'caretness';
      const si = new SessionInfo(SERVER_URL, 'token', did, cid);
      assert.deepEqual(si.logTags, [did, cid]);
    });

    it('is just the `documentId` if `caretId === null`', () => {
      const id = 'docness';
      const si = new SessionInfo(SERVER_URL, 'token', id);
      assert.deepEqual(si.logTags, [id]);
    });
  });

  describe('deconstruct()', () => {
    it('returns a three-element array when constructed with three arguments', () => {
      const si     = new SessionInfo(SERVER_URL, 'token', 'id');
      const result = si.deconstruct();

      assert.deepEqual(result, [SERVER_URL, 'token', 'id']);
    });

    it('returns a four-element array when constructed with four non-`null` arguments', () => {
      const si     = new SessionInfo(SERVER_URL, 'token', 'id', 'c');
      const result = si.deconstruct();

      assert.deepEqual(result, [SERVER_URL, 'token', 'id', 'c']);
    });
  });

  describe('withAuthorToken()', () => {
    it('returns a new instance given a string', () => {
      const orig1 = new SessionInfo(SERVER_URL, 'token', 'doc', 'caret-1');
      const orig2 = new SessionInfo(`${SERVER_URL}/123`, 'also-token', 'docky');

      function test(token) {
        const result1 = orig1.withAuthorToken(token);
        const expect1 = new SessionInfo(orig1.apiUrl, token, orig1.documentId, orig1.caretId);
        assert.deepEqual(result1, expect1);

        const result2 = orig2.withAuthorToken(token);
        const expect2 = new SessionInfo(orig2.apiUrl, token, orig2.documentId, orig2.caretId);
        assert.deepEqual(result2, expect2);
      }

      test('blort');
      test('boop');
    });

    it('returns a new instance given a `BearerToken`', () => {
      const orig1 = new SessionInfo(SERVER_URL, 'token', 'doc', 'caret-1');
      const orig2 = new SessionInfo(`${SERVER_URL}/123`, 'also-token', 'docky');

      function test(token) {
        const result1 = orig1.withAuthorToken(token);
        const expect1 = new SessionInfo(orig1.apiUrl, token, orig1.documentId, orig1.caretId);
        assert.deepEqual(result1, expect1);

        const result2 = orig2.withAuthorToken(token);
        const expect2 = new SessionInfo(orig2.apiUrl, token, orig2.documentId, orig2.caretId);
        assert.deepEqual(result2, expect2);
      }

      test(new BearerToken('abc', '123'));
      test(new BearerToken('blort', 'florp'));
    });

    it('rejects invalid arguments', () => {
      const si = new SessionInfo(SERVER_URL, 'token', 'doc');

      function test(value) {
        assert.throws(() => si.withAuthorToken(value), /badValue/);
      }

      test(undefined);
      test(null);
      test(914);
      test(['x']);
    });
  });

  describe('withCaretId()', () => {
    it('returns a new instance given a valid `caretId`', () => {
      const orig1 = new SessionInfo(SERVER_URL, 'token', 'doc', 'caret-1');
      const orig2 = new SessionInfo(`${SERVER_URL}/123`, 'also-token', 'docky');

      function test(c) {
        const result1 = orig1.withCaretId(c);
        const expect1 = new SessionInfo(orig1.apiUrl, orig1.authorToken, orig1.documentId, c);
        assert.deepEqual(result1, expect1);

        const result2 = orig2.withCaretId(c);
        const expect2 = new SessionInfo(orig2.apiUrl, orig2.authorToken, orig2.documentId, c);
        assert.deepEqual(result2, expect2);
      }

      test('beep');
      test('boop');
    });

    it('rejects invalid IDs', () => {
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

  describe('withoutCaretId()', () => {
    it('returns a new instance with `caretId === null`', () => {
      function test(orig) {
        const result = orig.withoutCaretId();
        const expect = new SessionInfo(orig.apiUrl, orig.authorToken, orig.documentId);

        assert.isNull(result.caretId);
        assert.deepEqual(result, expect);
      }

      test(new SessionInfo(SERVER_URL, 'a', 'b', 'c'));
      test(new SessionInfo(`${SERVER_URL}/123`, 'd', 'e'));
    });
  });
});
