// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseIdSyntax } from '@bayou/config-common';

/** {array<*>} Array of non-strings. */
const NON_STRINGS = [
  undefined,
  null,
  false,
  true,
  1,
  [],
  {},
  ['abc'],
  [123],
  { x: 'abc' },
  new Map()
];

describe('@bayou/config-server/BaseIdSyntax', () => {
  describe('checkAuthorId()', () => {
    it('rejects non-strings without calling through to `isAuthorId()`', () => {
      class Throws extends BaseIdSyntax {
        static isAuthorId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      for (const value of NON_STRINGS) {
        assert.throws(() => Throws.checkAuthorId(value), /badValue/, inspect(value));
      }
    });

    it('calls through to `isAuthorId()` and respects a `false` response', () => {
      let gotId = null;
      class AcceptsNone extends BaseIdSyntax {
        static isAuthorId(id) {
          gotId = id;
          return false;
        }
      }

      assert.throws(() => AcceptsNone.checkAuthorId('florp'), /badValue/);
      assert.strictEqual(gotId, 'florp');
    });

    it('calls through to `isAuthorId()` and respects a `true` response', () => {
      let gotId = null;
      class AcceptsAll extends BaseIdSyntax {
        static isAuthorId(id) {
          gotId = id;
          return true;
        }
      }

      assert.strictEqual(AcceptsAll.checkAuthorId('zorch'), 'zorch');
      assert.strictEqual(gotId, 'zorch');
    });
  });

  describe('checkAuthorIdOrNull()', () => {
    it('rejects non-`null` non-strings without calling through to `isAuthorId()`', () => {
      class Throws extends BaseIdSyntax {
        static isAuthorId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      for (const value of NON_STRINGS) {
        if (value !== null) {
          assert.throws(() => Throws.checkAuthorId(value), /badValue/, inspect(value));
        }
      }
    });

    it('accepts `null` without calling through to `isAuthorId()`', () => {
      class Throws extends BaseIdSyntax {
        static isAuthorId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      assert.isNull(Throws.checkAuthorIdOrNull(null));
    });

    it('calls through to `isAuthorId()` and respects a `false` response', () => {
      let gotId = null;
      class AcceptsNone extends BaseIdSyntax {
        static isAuthorId(id) {
          gotId = id;
          return false;
        }
      }

      assert.throws(() => AcceptsNone.checkAuthorIdOrNull('florp'), /badValue/);
      assert.strictEqual(gotId, 'florp');
    });

    it('calls through to `isAuthorId()` and respects a `true` response', () => {
      let gotId = null;
      class AcceptsAll extends BaseIdSyntax {
        static isAuthorId(id) {
          gotId = id;
          return true;
        }
      }

      assert.strictEqual(AcceptsAll.checkAuthorIdOrNull('zorch'), 'zorch');
      assert.strictEqual(gotId, 'zorch');
    });
  });

  describe('checkDocumentId()', () => {
    it('rejects non-strings without calling through to `isDocumentId()`', () => {
      class Throws extends BaseIdSyntax {
        static isDocumentId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      for (const value of NON_STRINGS) {
        assert.throws(() => Throws.checkDocumentId(value), /badValue/, inspect(value));
      }
    });

    it('calls through to `isDocumentId()` and respects a `false` response', () => {
      let gotId = null;
      class AcceptsNone extends BaseIdSyntax {
        static isDocumentId(id) {
          gotId = id;
          return false;
        }
      }

      assert.throws(() => AcceptsNone.checkDocumentId('florp'), /badValue/);
      assert.strictEqual(gotId, 'florp');
    });

    it('calls through to `isDocumentId()` and respects a `true` response', () => {
      let gotId = null;
      class AcceptsAll extends BaseIdSyntax {
        static isDocumentId(id) {
          gotId = id;
          return true;
        }
      }

      assert.strictEqual(AcceptsAll.checkDocumentId('zorch'), 'zorch');
      assert.strictEqual(gotId, 'zorch');
    });
  });
});
