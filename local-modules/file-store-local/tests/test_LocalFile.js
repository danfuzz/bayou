// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { after, describe, it } from 'mocha';

import { Codec } from 'codec';
import { LocalFile } from 'file-store-local';
import { TheModule as fileStoreOt_TheModule, TransactionOp, TransactionSpec } from 'file-store-ot';
import { FrozenBuffer } from 'util-common';

import TempFiles from './TempFiles';

/** {Codec} Codec instance to use. */
const codec = new Codec();
fileStoreOt_TheModule.registerCodecs(codec.registry);

/**
 * Makes a {@link LocalFile}.
 *
 * @param {string} [path = null] Path to use for the file, or `null` to have
 *   this function pick one (a unique temporary directory).
 * @returns {LocalFile} An appropriately-constructed instance.
 */
function makeLocalFile(path = null) {
  if (path === null) {
    path = TempFiles.uniquePath();
  }

  return new LocalFile('x0x', path, codec);
}

describe('file-store-local/LocalFile', () => {
  // The expectation was that this would run after all tests were finish and
  // clean up the directory into which we are writing test files. However, since
  // it takes as much as 5 seconds for any `LocalFile` files to be written to
  // disk, it's not safe to `rmdir` the directory. Mocha has an internal rule
  // that you can't take more than 2 seconds to finish your work in the
  // `after()` hook and call the `done()` callback.
  after(function (done) {
    // setTimeout(() => {
    //   fs.rmdirSync(storeDir);
    //   storeDir = null;

    done();
    // }, 2000);
  });

  describe('constructor()', () => {
    it('should not throw given valid arguments', () => {
      assert.doesNotThrow(() => { makeLocalFile(); });
    });
  });

  describe('create()', () => {
    it('should cause a non-existent file to come into existence', async () => {
      const file = makeLocalFile();

      assert.isFalse(await file.exists()); // Baseline assumption.
      await file.create();

      assert.isTrue(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });

    it('should do nothing if called on a non-empty file', async () => {
      const file = makeLocalFile();
      const storagePath = '/abc';
      const value = FrozenBuffer.coerce('x');

      // Baseline assumption.

      let spec = new TransactionSpec(
        TransactionOp.op_writePath(storagePath, value)
      );

      await file.create();
      await file.transact(spec);

      spec = new TransactionSpec(
        TransactionOp.op_readPath(storagePath)
      );

      let result = (await file.transact(spec)).data.get(storagePath);
      assert.strictEqual(result.string, value.string);

      // The real test.

      await file.create();

      // Ensure the file exists.
      assert.isTrue(await file.exists());

      // Same transaction as above.
      result = (await file.transact(spec)).data.get(storagePath);
      assert.strictEqual(result.string, value.string);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('delete()', () => {
    it('should cause an existing file to stop existing', async () => {
      const file = makeLocalFile();
      await file.create();
      assert.isTrue(await file.exists()); // Baseline assumption.

      await file.delete();
      assert.isFalse(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });
  });

  describe('exists()', () => {
    it('should return `false` if the underlying storage does not exist', async () => {
      const file = makeLocalFile();
      assert.isFalse(await file.exists());
    });

    it('should return `true` if the file was created in the filesystem', async () => {
      const dir = TempFiles.uniquePath();
      const file1 = makeLocalFile(dir);

      await file1.create();

      // Baseline assumption: Check that `file1` believes itself to exist.
      assert.isTrue(await file1.exists());

      // Check that the filesystem reflects the existence too.

      await file1.flush();

      const file2 = makeLocalFile(dir);
      assert.isTrue(await file2.exists());

      await TempFiles.doneWithFile(file2);
    });
  });
});
