// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FileOp, TransactionSpec } from 'file-store';
import { LocalFile } from 'file-store-local';

import TempFiles from './TempFiles';

describe('file-store-local/LocalFile.transact', () => {
  it('should throw an error if the file doesn\'t exist', async () => {
    const file = new LocalFile('0', TempFiles.uniquePath());
    assert.isFalse(await file.exists()); // Baseline assumption.

    // The actual test.
    const spec = new TransactionSpec();
    await assert.isRejected(file.transact(spec));
  });

  it('should succeed and return no data from an empty transaction on an existing file', async () => {
    const file = new LocalFile('0', TempFiles.uniquePath());
    await file.create();

    const spec = new TransactionSpec();
    const result = await file.transact(spec);
    assert.strictEqual(result.revNum, 0);
    assert.isUndefined(result.newRevNum);
    assert.isUndefined(result.data);
  });

  describe('op listPath', () => {
    it('should return an empty set when no results are found', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(FileOp.op_listPath('/blort'));
      const result = await file.transact(spec);
      assert.instanceOf(result.paths, Set);
      assert.strictEqual(result.paths.size, 0);
    });
  });
});
