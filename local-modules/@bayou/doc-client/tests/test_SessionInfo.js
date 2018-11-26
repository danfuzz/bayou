// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { SessionInfo } from '@bayou/doc-client';

describe('@bayou/doc-client/SessionInfo', () => {
  describe('constructor()', () => {
    it('should accept three strings', () => {
      // **TODO:** Will have to be updated when validation is improved. Likewise
      // throughout the file.
      const result = new SessionInfo('one', 'two', 'three');
      assert.isFrozen(result);
    });

    it('should accept two strings', () => {
      const result = new SessionInfo('one', 'two');
      assert.isFrozen(result);
    });

    it('should accept two strings and `null`', () => {
      const result = new SessionInfo('one', 'two', null);
      assert.isFrozen(result);
    });

    it('should reject invalid arguments', () => {
      function test(...args) {
        assert.throws(() => new SessionInfo(...args));
      }

      test(null, 'x', 'y');
      test(123,  'x', 'y');
      test([],   'x', 'y');

      test('token', null,      'y');
      test('token', false,     'y');
      test('token', { x: 10 }, 'y');

      test('token', 'x', true);
      test('token', 'x', new Set());
    });
  });

  describe('.authorToken', () => {
    it('should be the constructed value', () => {
      const token  = 'florp';
      const result = new SessionInfo(token, 'x');
      assert.strictEqual(result.authorToken, token);
    });
  });

  describe('.documentId', () => {
    it('should be the constructed value', () => {
      const id     = 'blort';
      const result = new SessionInfo('token', id);
      assert.strictEqual(result.documentId, id);
    });
  });

  describe('.caretId', () => {
    it('should be the constructed value', () => {
      const id     = 'zorch';
      const result = new SessionInfo('token', 'doc', id);
      assert.strictEqual(result.caretId, id);
    });

    it('should be `null` if not passed in the constructor', () => {
      const result = new SessionInfo('token', 'doc');
      assert.isNull(result.caretId);
    });
  });

  describe('deconstruct()', () => {
    it('should return a two-element array when constructed with two arguments', () => {
      const si     = new SessionInfo('token', 'id');
      const result = si.deconstruct();

      assert.deepEqual(result, ['token', 'id']);
    });

    it('should return a three-element array when constructed with three non-`null` arguments', () => {
      const si     = new SessionInfo('token', 'id', 'c');
      const result = si.deconstruct();

      assert.deepEqual(result, ['token', 'id', 'c']);
    });
  });
});
