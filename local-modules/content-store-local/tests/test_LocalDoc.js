// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import fs from 'fs';
import { after, before, describe, it } from 'mocha';
import path from 'path';

import { LocalDoc } from 'content-store-local';
import { FrozenBuffer } from 'util-server';

const STORE_PREFIX = 'bayou-test-';
let storeDir = null;

describe('content-store-local/LocalDoc', () => {
  before(() => {
    storeDir = fs.mkdtempSync(STORE_PREFIX);
  });

  // The expectation was that this would run after all tests were finish and
  // clean up the directory into which we are writing test files. However, since
  // it takes as much as 5 seconds for any `LocalDoc` files to be written to
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

  describe('constructor(docId, docPath)', () => {
    it('should create a local dir for storing files at the specified path', () => {
      const doc = new LocalDoc('0', documentPath());

      assert.isNotNull(doc);
    });
  });

  describe('create()', () => {
    it('should erase the document if called on a non-empty document', async () => {
      const doc = new LocalDoc('0', documentPath());
      const storagePath = '/abc';
      const value = FrozenBuffer.coerce('x');

      // Baseline assumption.
      await doc.create();
      await doc.opForceWrite(storagePath, value);
      assert.strictEqual(await doc.pathReadOrNull(storagePath), value);

      // The real test.
      await doc.create();
      assert.strictEqual(await doc.pathReadOrNull(storagePath), null);
    });
  });
});

function documentPath() {
  return path.join(storeDir, 'test_file');
}
