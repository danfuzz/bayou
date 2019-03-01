// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FileChange, FileOp } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

import TempFiles from './TempFiles';

describe('@bayou/file-store-local/LocalFile', () => {
  describe('constructor()', () => {
    it('should not throw given valid arguments', () => {
      assert.doesNotThrow(() => { TempFiles.makeFile(); });
    });
  });

  // **TODO:** Need to test `appendChange()`. See other TODO below for an
  // example that should be extracted into a test here (and fixed).

  describe('create()', () => {
    it('should cause a non-existent file to come into existence', async () => {
      const file = TempFiles.makeFile();

      assert.isFalse(await file.exists()); // Baseline assumption.
      await file.create();

      assert.isTrue(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });

    it('should do nothing if called on a non-empty file', async () => {
      const file        = await TempFiles.makeAndCreateFile();
      const storagePath = '/abc';
      const value       = FrozenBuffer.coerce('x');

      // Baseline setup / assumption.

      const change1 = new FileChange(1, [FileOp.op_writePath(storagePath, value)]);
      // **TODO:** Adding this line should fail, but doesn't!!
      // await file.appendChange(FileChange.FIRST);
      await file.appendChange(change1);

      assert.isTrue(await file.exists());
      assert.doesNotThrow(() => file.currentSnapshot.checkPathIs(storagePath, value));

      // The real test.

      await assert.isFulfilled(file.create());

      // Ensure the file exists and that the path that was written is still
      // there.
      assert.isTrue(await file.exists());
      assert.doesNotThrow(() => file.currentSnapshot.checkPathIs(storagePath, value));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('delete()', () => {
    it('should cause an existing file to stop existing', async () => {
      const file = await TempFiles.makeAndCreateFile();
      assert.isTrue(await file.exists()); // Baseline assumption.

      await file.delete();
      assert.isFalse(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });
  });

  describe('exists()', () => {
    it('should return `false` if the underlying storage does not exist', async () => {
      const file = TempFiles.makeFile();
      assert.isFalse(await file.exists());

      await TempFiles.doneWithFile(file);
    });

    it('should return `true` if the file was created in the filesystem', async () => {
      const dir = TempFiles.uniquePath();
      const file1 = await TempFiles.makeAndCreateFile(dir);

      // Baseline assumption: Check that `file1` believes itself to exist.
      assert.isTrue(await file1.exists());

      // Check that the filesystem reflects the existence too.

      await file1.flush();

      const file2 = TempFiles.makeFile(dir);
      assert.isTrue(await file2.exists());

      await TempFiles.doneWithFile(file2);
    });
  });
});
