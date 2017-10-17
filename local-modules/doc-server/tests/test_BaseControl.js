// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { BaseControl } from 'doc-server';
import { Codec } from 'codec';
import { MockSnapshot } from 'doc-common/mocks';
import { FileAccess } from 'doc-server';
import { MockControl } from 'doc-server/mocks';
import { MockFile } from 'file-store/mocks';

describe('doc-server/BaseControl', () => {
  describe('.changeClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.changeClass;
      assert.strictEqual(result, MockSnapshot.changeClass);
    });
  });

  describe('.snapshotClass', () => {
    it('should reflect the subclass\'s implementation', () => {
      const result = MockControl.snapshotClass;
      assert.strictEqual(result, MockSnapshot);
    });

    it('should reject an improper subclass choice', () => {
      class HasBadSnapshot extends BaseControl {
        static get _impl_snapshotClass() {
          return Object;
        }
      }

      assert.throws(() => HasBadSnapshot.snapshotClass);
    });

    it('should only ever ask the subclass once', () => {
      class GoodControl extends BaseControl {
        static get _impl_snapshotClass() {
          this.count++;
          return MockSnapshot;
        }
      }

      GoodControl.count = 0;
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);
      assert.strictEqual(GoodControl.snapshotClass, MockSnapshot);

      assert.strictEqual(GoodControl.count, 1);
    });
  });

  describe('constructor()', () => {
    it('should accept a `FileAccess` and reflect it in the inherited getters', () => {
      const codec  = Codec.theOne;
      const file   = new MockFile('blort');
      const fa     = new FileAccess(codec, file);
      const result = new MockControl(fa);

      assert.strictEqual(result.codec,         codec);
      assert.strictEqual(result.file,          file);
      assert.strictEqual(result.fileAccess,    fa);
      assert.strictEqual(result.fileCodec,     fa.fileCodec);
      assert.strictEqual(result.log,           fa.log);
      assert.strictEqual(result.schemaVersion, fa.schemaVersion);
    });

    it('should reject non-`FileAccess` arguments', () => {
      assert.throws(() => new MockControl(null));
      assert.throws(() => new MockControl({ x: 10 }));
    });
  });

  // **TODO:** Fill this out!
});
