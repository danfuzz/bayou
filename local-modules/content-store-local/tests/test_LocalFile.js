// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import fs from 'fs';
import { after, before, describe, it } from 'mocha';
import path from 'path';

import { FileOp, TransactionSpec } from 'content-store';
import { LocalFile } from 'content-store-local';
import { FrozenBuffer } from 'util-common';

const STORE_PREFIX = 'bayou-test-';
let storeDir = null;

describe('content-store-local/LocalFile', () => {
  before(() => {
    storeDir = fs.mkdtempSync(STORE_PREFIX);
  });

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

  describe('constructor(fileId, filePath)', () => {
    it('should create a local dir for storing files at the specified path', () => {
      const file = new LocalFile('0', filePath());

      assert.isNotNull(file);
    });
  });

  describe('create()', () => {
    it('should erase the file if called on a non-empty file', async () => {
      const file = new LocalFile('0', filePath());
      const storagePath = '/abc';
      const value = FrozenBuffer.coerce('x');

      // Baseline assumption.
      await file.create();
      const spec = new TransactionSpec(
        FileOp.op_writePath(storagePath, value)
      );
      await file.transact(spec);

      assert.strictEqual(await file.pathReadOrNull(storagePath), value);

      // The real test.
      await file.create();
      assert.strictEqual(await file.pathReadOrNull(storagePath), null);
    });
  });
});

function filePath() {
  return path.join(storeDir, 'test_file');
}
