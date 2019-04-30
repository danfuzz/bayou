// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseDocStore } from '@bayou/config-server';

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

describe('@bayou/config-server/BaseDocStore', () => {
  describe('author ID methods', () => {
    describe('checkAuthorIdSyntax()', () => {
      it('rejects non-strings without calling through to the impl', () => {
        class Throws extends BaseDocStore {
          _impl_isAuthorId(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        for (const value of NON_STRINGS) {
          assert.throws(() => obj.checkAuthorIdSyntax(value), /badValue/, inspect(value));
        }
      });

      it('calls through to `isAuthorId()` and respects a `false` response', () => {
        let gotId = null;
        class AcceptsNone extends BaseDocStore {
          isAuthorId(id) {
            gotId = id;
            return false;
          }
        }

        const obj = new AcceptsNone();
        assert.throws(() => obj.checkAuthorIdSyntax('florp'), /badValue/);
        assert.strictEqual(gotId, 'florp');
      });

      it('calls through to `isAuthorId()` and respects a `true` response', () => {
        let gotId = null;
        class AcceptsAll extends BaseDocStore {
          isAuthorId(id) {
            gotId = id;
            return true;
          }
        }

        const obj = new AcceptsAll();
        assert.strictEqual(obj.checkAuthorIdSyntax('zorch'), 'zorch');
        assert.strictEqual(gotId, 'zorch');
      });
    });

    describe('checkExistingAuthorId()', () => {
      it('calls `getAuthorInfo()` and transparently rethrows errors', async () => {
        let gotId = null;
        class Throws extends BaseDocStore {
          async getAuthorInfo(id) {
            gotId = id;
            throw new Error('woop');
          }
        }

        const obj = new Throws();
        await assert.isRejected(obj.checkExistingAuthorId('xyz'), /woop/);
        assert.strictEqual(gotId, 'xyz');
      });

      it('calls `getAuthorInfo()` and converts `valid: false` to an error', async () => {
        let gotId = null;
        class NeverValid extends BaseDocStore {
          async getAuthorInfo(id) {
            gotId = id;
            return { valid: false, exists: false };
          }
        }

        const obj = new NeverValid();
        await assert.isRejected(obj.checkExistingAuthorId('pdq'), /badData/);
        assert.strictEqual(gotId, 'pdq');
      });

      it('calls `getAuthorInfo()` and converts `exists: false` to an error', async () => {
        let gotId = null;
        class NeverExists extends BaseDocStore {
          async getAuthorInfo(id) {
            gotId = id;
            return { valid: true, exists: false };
          }
        }

        const obj = new NeverExists();
        await assert.isRejected(obj.checkExistingAuthorId('nine-one-four'), /badData/);
        assert.strictEqual(gotId, 'nine-one-four');
      });

      it('calls `getAuthorInfo()` and accepts `valid: true, exists: true`', async () => {
        let gotId = null;
        class AlwaysValid extends BaseDocStore {
          async getAuthorInfo(id) {
            gotId = id;
            return { valid: true, exists: true };
          }
        }

        const obj = new AlwaysValid();

        const result = await obj.checkExistingAuthorId('yes');
        assert.strictEqual(result, 'yes');
        assert.strictEqual(gotId, 'yes');
      });
    });

    describe('getAuthorInfo()', () => {
      it('rejects non-strings without calling through to the impl', async () => {
        class Throws extends BaseDocStore {
          async _impl_getAuthorInfo(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        for (const value of NON_STRINGS) {
          await assert.isRejected(obj.getAuthorInfo(value), /badValue/, inspect(value));
        }
      });

      it('rejects syntactically invalid strings without calling through to the impl', async () => {
        let gotId = null;
        class Throws extends BaseDocStore {
          isAuthorId(id) {
            gotId = id;
            return false;
          }

          async _impl_getAuthorInfo(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        await assert.isRejected(obj.getAuthorInfo('boop'), /badValue/);
        assert.strictEqual(gotId, 'boop');
      });

      it('calls through to the impl when given a valid ID', async () => {
        let gotId = null;
        class AcceptsAll extends BaseDocStore {
          isAuthorId(id) {
            gotId = id;
            return true;
          }

          async _impl_getAuthorInfo(id_unused) {
            return { exists: true, valid: true };
          }
        }

        const obj    = new AcceptsAll();
        const result = await obj.getAuthorInfo('beep');
        assert.deepEqual(result, { exists: true, valid: true });
        assert.strictEqual(gotId, 'beep');
      });
    });
  });

  describe('document ID methods', () => {
    describe('checkDocumentIdSyntax()', () => {
      it('rejects non-strings without calling through to the impl', () => {
        class Throws extends BaseDocStore {
          _impl_isDocumentId(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        for (const value of NON_STRINGS) {
          assert.throws(() => obj.checkDocumentIdSyntax(value), /badValue/, inspect(value));
        }
      });

      it('calls through to `isDocumentId()` and respects a `false` response', () => {
        let gotId = null;
        class AcceptsNone extends BaseDocStore {
          isDocumentId(id) {
            gotId = id;
            return false;
          }
        }

        const obj = new AcceptsNone();
        assert.throws(() => obj.checkDocumentIdSyntax('florp'), /badValue/);
        assert.strictEqual(gotId, 'florp');
      });

      it('calls through to `isDocumentId()` and respects a `true` response', () => {
        let gotId = null;
        class AcceptsAll extends BaseDocStore {
          isDocumentId(id) {
            gotId = id;
            return true;
          }
        }

        const obj = new AcceptsAll();
        assert.strictEqual(obj.checkDocumentIdSyntax('zorch'), 'zorch');
        assert.strictEqual(gotId, 'zorch');
      });
    });

    describe('checkExistingDocumentId()', () => {
      it('calls `getDocumentInfo()` and transparently rethrows errors', async () => {
        let gotId = null;
        class Throws extends BaseDocStore {
          async getDocumentInfo(id) {
            gotId = id;
            throw new Error('woop');
          }
        }

        const obj = new Throws();
        await assert.isRejected(obj.checkExistingDocumentId('xyz'), /woop/);
        assert.strictEqual(gotId, 'xyz');
      });

      it('calls `getDocumentInfo()` and converts `valid: false` to an error', async () => {
        let gotId = null;
        class NeverValid extends BaseDocStore {
          async getDocumentInfo(id) {
            gotId = id;
            return { valid: false, exists: false, fileId: null };
          }
        }

        const obj = new NeverValid();
        await assert.isRejected(obj.checkExistingDocumentId('pdq'), /badData/);
        assert.strictEqual(gotId, 'pdq');
      });

      it('calls `getDocumentInfo()` and converts `exists: false` to an error', async () => {
        let gotId = null;
        class NeverExists extends BaseDocStore {
          async getDocumentInfo(id) {
            gotId = id;
            return { valid: true, exists: false, fileId: null };
          }
        }

        const obj = new NeverExists();
        await assert.isRejected(obj.checkExistingDocumentId('nine-one-four'), /badData/);
        assert.strictEqual(gotId, 'nine-one-four');
      });

      it('calls `getDocumentInfo()` and accepts `valid: true, exists: true`', async () => {
        let gotId = null;
        class AlwaysValid extends BaseDocStore {
          async getDocumentInfo(id) {
            gotId = id;
            return { valid: true, exists: true, fileId: 914 };
          }
        }

        const obj = new AlwaysValid();

        const result = await obj.checkExistingDocumentId('yes');
        assert.strictEqual(result, 'yes');
        assert.strictEqual(gotId, 'yes');
      });
    });

    describe('getDocumentInfo()', () => {
      it('rejects non-strings without calling through to the impl', async () => {
        class Throws extends BaseDocStore {
          async _impl_getDocumentInfo(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        for (const value of NON_STRINGS) {
          await assert.isRejected(obj.getDocumentInfo(value), /badValue/, inspect(value));
        }
      });

      it('rejects syntactically invalid strings without calling through to the impl', async () => {
        let gotId = null;
        class Throws extends BaseDocStore {
          isDocumentId(id) {
            gotId = id;
            return false;
          }

          async _impl_getDocumentInfo(id_unused) {
            throw new Error('should-not-be-called');
          }
        }

        const obj = new Throws();
        await assert.isRejected(obj.getDocumentInfo('boop'), /badValue/);
        assert.strictEqual(gotId, 'boop');
      });

      it('calls through to the impl when given a valid ID', async () => {
        let gotId = null;
        class AcceptsAll extends BaseDocStore {
          isDocumentId(id) {
            gotId = id;
            return true;
          }

          async _impl_getDocumentInfo(id_unused) {
            return { exists: true, valid: true, fileId: 'whatever' };
          }
        }

        const obj    = new AcceptsAll();
        const result = await obj.getDocumentInfo('beep');
        assert.deepEqual(result, { exists: true, valid: true, fileId: 'whatever' });
        assert.strictEqual(gotId, 'beep');
      });
    });
  });

  describe('getPermissions()', () => {
    it('rejects non-strings without calling through to the impl', async () => {
      class Throws extends BaseDocStore {
        _impl_isAuthorId(id_unused) {
          return true;
        }

        _impl_isDocumentId(id_unused) {
          return true;
        }

        async _impl_getPermissions(authorId_unused, documentId_unused) {
          throw new Error('should-not-be-called');
        }
      }

      const obj = new Throws();
      for (const value of NON_STRINGS) {
        await assert.isRejected(obj.getPermissions(value, 'x'), /badValue/, inspect(value));
        await assert.isRejected(obj.getPermissions('x', value), /badValue/, inspect(value));
        await assert.isRejected(obj.getPermissions(value, value), /badValue/, inspect(value));
      }
    });

    it('rejects syntactically invalid strings without calling through to the impl', async () => {
      let gotAuthorId   = null;
      let gotDocumentId = null;

      class Throws extends BaseDocStore {
        _impl_isAuthorId(id) {
          gotAuthorId = id;
          return id === 'good';
        }

        _impl_isDocumentId(id) {
          gotDocumentId = id;
          return id === 'good';
        }

        async _impl_getPermissions(authorId_unused, documentId_unused) {
          throw new Error('should-not-be-called');
        }
      }

      const obj = new Throws();

      await assert.isRejected(obj.getPermissions('bad', 'good'), /badValue/);
      assert.strictEqual(gotAuthorId, 'bad');

      await assert.isRejected(obj.getPermissions('good', 'bad'), /badValue/);
      assert.strictEqual(gotDocumentId, 'bad');
    });

    it('calls through to the impl when given valid IDs', async () => {
      let gotAuthorId   = null;
      let gotDocumentId = null;

      class AcceptsAll extends BaseDocStore {
        _impl_isAuthorId(id) {
          gotAuthorId = id;
          return true;
        }

        _impl_isDocumentId(id) {
          gotDocumentId = id;
          return true;
        }

        async _impl_getPermissions(authorId, documentId) {
          if (authorId !== gotAuthorId) {
            throw new Error('unexpected `authorId` mismatch');
          }

          if (documentId !== gotDocumentId) {
            throw new Error('unexpected `documentId` mismatch');
          }

          const canEdit = /edit/.test(documentId);
          const canView = /view/.test(documentId);
          return { canEdit, canView };
        }
      }

      const obj = new AcceptsAll();

      const result1 = await obj.getPermissions('x', 'edit-view');
      assert.deepEqual(result1, { canEdit: true, canView: true });
      assert.strictEqual(gotAuthorId, 'x');
      assert.strictEqual(gotDocumentId, 'edit-view');

      const result2 = await obj.getPermissions('y', 'view');
      assert.deepEqual(result2, { canEdit: false, canView: true });
      assert.strictEqual(gotAuthorId, 'y');
      assert.strictEqual(gotDocumentId, 'view');

      const result3 = await obj.getPermissions('z', 'nope');
      assert.deepEqual(result3, { canEdit: false, canView: false });
      assert.strictEqual(gotAuthorId, 'z');
      assert.strictEqual(gotDocumentId, 'nope');

      // This test makes the `_impl` violate the superclass contract and checks
      // for the expected error.
      await assert.isRejected(obj.getPermissions('x', 'edit'), /badUse/);
      assert.strictEqual(gotAuthorId, 'x');
      assert.strictEqual(gotDocumentId, 'edit');
    });
  });
});
