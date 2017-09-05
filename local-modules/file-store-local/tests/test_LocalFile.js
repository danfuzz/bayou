// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import fs from 'fs';
import { after, describe, it } from 'mocha';

import { FileOp, TransactionSpec } from 'file-store';
import { LocalFile } from 'file-store-local';
import { FrozenBuffer } from 'util-common';

import TempFiles from './TempFiles';

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
      assert.doesNotThrow(() => { new LocalFile('0', TempFiles.uniquePath()); });
    });
  });

  describe('create()', () => {
    it('should cause a non-existent file to come into existence', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());

      assert.isFalse(await file.exists()); // Baseline assumption.
      await file.create();

      assert.isTrue(await file.exists()); // The actual test.
    });

    it('should do nothing if called on a non-empty file', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const storagePath = '/abc';
      const value = FrozenBuffer.coerce('x');

      // Baseline assumption.

      let spec = new TransactionSpec(
        FileOp.op_writePath(storagePath, value)
      );

      await file.create();
      await file.transact(spec);

      spec = new TransactionSpec(
        FileOp.op_readPath(storagePath)
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
    });
  });

  describe('delete()', () => {
    it('should cause an existing file to stop existing', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();
      assert.isTrue(await file.exists()); // Baseline assumption.

      await file.delete();
      assert.isFalse(await file.exists()); // The actual test.
    });
  });

  describe('exists()', () => {
    it('should return `false` if the underlying storage does not exist', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      assert.isFalse(await file.exists());
    });

    it('should return `true` if the underlying storage does exist', async () => {
      const dir = TempFiles.uniquePath();
      const file = new LocalFile('0', dir);

      fs.mkdirSync(dir);
      assert.isTrue(await file.exists());
    });
  });
});
