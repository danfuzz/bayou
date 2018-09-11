// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseIdSyntax } from '@bayou/config-common';

describe('@bayou/config-server/BaseIdSyntax', () => {
  describe('checkAuthorId()', () => {
    it('rejects non-strings without calling through to `isAuthorId()`', () => {
      class Throws extends BaseIdSyntax {
        static isAuthorId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      assert.throws(() => Throws.checkAuthorId(123), /badValue/);
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

  describe('checkDocumentId()', () => {
    it('rejects non-strings without calling through to `isDocumentId()`', () => {
      class Throws extends BaseIdSyntax {
        static isDocumentId(id_unused) {
          throw new Error('should-not-be-called');
        }
      }

      assert.throws(() => Throws.checkDocumentId(123), /badValue/);
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
