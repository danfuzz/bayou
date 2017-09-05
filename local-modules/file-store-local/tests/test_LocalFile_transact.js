// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FileOp, TransactionSpec } from 'file-store';
import { LocalFile } from 'file-store-local';
import { FrozenBuffer } from 'util-common';

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

  describe('op checkBlobAbsent', () => {
    it('should succeed when the blob is absent', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(
        FileOp.op_checkBlobAbsent(new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);
    });

    it('should fail when the blob is present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Likes are now florps.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(FileOp.op_checkBlobAbsent(blob));
      await assert.isRejected(file.transact(spec));
    });
  });

  describe('op checkBlobPresent', () => {
    it('should succeed when the blob is present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Likes are now florps.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(FileOp.op_checkBlobPresent(blob));
      await assert.isFulfilled(file.transact(spec));
    });

    it('should fail when the blob is absent', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(
        FileOp.op_checkBlobPresent(new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isRejected(resultProm);
    });
  });

  describe('op checkPathIs', () => {
    it('should succeed when the path is present and content matches', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();
      await file.transact(
        new TransactionSpec(FileOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        FileOp.op_checkPathIs('/blort', new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 1);
    });

    it('should fail when the path is not present at all', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(
        FileOp.op_checkPathIs('/blort', new FrozenBuffer('anything')));
      await assert.isRejected(file.transact(spec));
    });

    it('should fail when the path is present and content does not match', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();
      await file.transact(
        new TransactionSpec(FileOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        FileOp.op_checkPathIs('/blort', new FrozenBuffer('not-blort')));
      await assert.isRejected(file.transact(spec));
    });
  });

  describe('op checkPathNot', () => {
    it('should succeed when the path is not present at all', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(
        FileOp.op_checkPathNot('/blort', new FrozenBuffer('anything')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 0);
    });

    it('should succeed when the path is present and content does not match', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();
      await file.transact(
        new TransactionSpec(FileOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        FileOp.op_checkPathNot('/blort', new FrozenBuffer('not-blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 1);
    });

    it('should fail when the path is present and content matches', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();
      await file.transact(
        new TransactionSpec(FileOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        FileOp.op_checkPathNot('/blort', new FrozenBuffer('blort')));
      await assert.isRejected(file.transact(spec));
    });
  });

  describe('op deleteBlob', () => {
    it('should succeed in deleting the indicated blob', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(FileOp.op_deleteBlob(blob));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(FileOp.op_checkBlobAbsent(blob));
      await assert.isFulfilled(file.transact(checkSpec));
    });

    it('should succeed even if the blob is not present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.create();

      const spec = new TransactionSpec(FileOp.op_deleteBlob(blob));
      await assert.isFulfilled(file.transact(spec));
    });
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

    it('should return a single result immediately under the path', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      let spec = new TransactionSpec(
        FileOp.op_writePath('/blort/yep', new FrozenBuffer('yep')),
        FileOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(FileOp.op_listPath('/blort'));
      const result = await file.transact(spec);
      const paths = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 1);
      assert.isTrue(paths.has('/blort/yep'));
    });

    it('should return a single result immediately under the path, even if the full result path has more components', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      let spec = new TransactionSpec(
        FileOp.op_writePath('/blort/yep/nope', new FrozenBuffer('yep')),
        FileOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(FileOp.op_listPath('/blort'));
      const result = await file.transact(spec);
      const paths = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 1);
      assert.isTrue(paths.has('/blort/yep'));
    });

    it('should return multiple results properly', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      let spec = new TransactionSpec(
        FileOp.op_writePath('/abraxas/1/2/3', new FrozenBuffer('nope')),
        FileOp.op_writePath('/blort/nope', new FrozenBuffer('nope')),
        FileOp.op_writePath('/blort/x/affirmed', new FrozenBuffer('yep')),
        FileOp.op_writePath('/blort/x/definitely/a/b/c', new FrozenBuffer('yep')),
        FileOp.op_writePath('/blort/x/definitely/d/e/f', new FrozenBuffer('yep')),
        FileOp.op_writePath('/blort/x/yep/1', new FrozenBuffer('yep')),
        FileOp.op_writePath('/blort/x/yep/2', new FrozenBuffer('yep')),
        FileOp.op_writePath('/blort/x/yep/3', new FrozenBuffer('yep')),
        FileOp.op_writePath('/nope', new FrozenBuffer('nope')),
        FileOp.op_writePath('/nope/blort', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(FileOp.op_listPath('/blort/x'));
      const result = await file.transact(spec);
      const paths = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 3);
      assert.isTrue(paths.has('/blort/x/yep'));
      assert.isTrue(paths.has('/blort/x/affirmed'));
      assert.isTrue(paths.has('/blort/x/definitely'));
    });
  });

  describe('op readBlob', () => {
    it('should succeed in reading a blob that is in the file', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Muffins are now biscuits.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writeBlob(blob)));

      // The reading is based on the hash of `blob`, so it's irrelevant that
      // the given argument is actually the content in question.
      const spec = new TransactionSpec(FileOp.op_readBlob(blob));
      const transactionResult = await assert.isFulfilled(file.transact(spec));

      assert.strictEqual(transactionResult.data.get(blob.hash), blob);
    });

    it('should succeed even if the blob is not present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Muffins are now biscuits.');
      await file.create();

      const spec = new TransactionSpec(FileOp.op_readBlob(blob));
      const transactionResult = await assert.isFulfilled(file.transact(spec));

      assert.strictEqual(transactionResult.data.size, 0);
    });
  });
});
