// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { DefaultIdSyntax } from '@bayou/id-syntax-default';

/** {array<*>} Array of non-strings. */
const NON_STRINGS = [
  undefined,
  null,
  false,
  true,
  1,
  [],
  {},
  ['T00-U00'],
  ['T00-F00'],
  { x: 'abc' },
  new Map()
];

describe('@bayou/id-syntax-default/DefaultIdSyntax', () => {
  describe('isAuthorId()', () => {
    it('accepts 32-character alphanum ASCII strings', () => {
      assert.isTrue(DefaultIdSyntax.isAuthorId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(DefaultIdSyntax.isAuthorId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(DefaultIdSyntax.isAuthorId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(DefaultIdSyntax.isAuthorId('123456789\t123456789+12'));
    });

    it('throws an error given a non-string argument', () => {
      for (const id of NON_STRINGS) {
        assert.throws(() => DefaultIdSyntax.isAuthorId(id), /badValue/, id);
      }
    });
  });

  describe('isDocumentId()', () => {
    it('accepts 32-character alphanum ASCII strings', () => {
      assert.isTrue(DefaultIdSyntax.isDocumentId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(DefaultIdSyntax.isDocumentId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(DefaultIdSyntax.isDocumentId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(DefaultIdSyntax.isDocumentId('123456789\t123456789+12'));
    });

    it('throws an error given a non-string argument', () => {
      for (const id of NON_STRINGS) {
        assert.throws(() => DefaultIdSyntax.isDocumentId(id), /badValue/, id);
      }
    });
  });

  describe('isFileId()', () => {
    it('accepts 32-character alphanum ASCII strings', () => {
      assert.isTrue(DefaultIdSyntax.isFileId('123abc7890ABC456789012'));
    });

    it('should allow underscores and hyphens', () => {
      assert.isTrue(DefaultIdSyntax.isFileId('123456789_123456789-12'));
    });

    it('should not allow non-ASCII characters', () => {
      assert.isFalse(DefaultIdSyntax.isFileId('123456789•123456789•12'));
    });

    it('should not allow non-alphanum characters', () => {
      assert.isFalse(DefaultIdSyntax.isFileId('123456789\t123456789+12'));
    });

    it('throws an error given a non-string argument', () => {
      for (const id of NON_STRINGS) {
        assert.throws(() => DefaultIdSyntax.isFileId(id), /badValue/, id);
      }
    });
  });
});
