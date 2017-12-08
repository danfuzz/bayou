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

  describe('op deletePath', () => {
    it('should succeed in deleting the indicated path', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writePath('/florp', blob)));

      const spec = new TransactionSpec(FileOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(FileOp.op_checkPathAbsent('/florp'));
      await assert.isFulfilled(file.transact(checkSpec));
    });

    it('should succeed even if the path is not present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(FileOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));
    });

    it('should not affect non-listed paths', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.create();
      await file.transact(new TransactionSpec(
        FileOp.op_writePath('/florp', blob),
        FileOp.op_writePath('/blort', blob),
        FileOp.op_writePath('/glorch', blob)
      ));

      const spec = new TransactionSpec(FileOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        FileOp.op_checkPathAbsent('/florp'),
        FileOp.op_checkPathPresent('/blort'),
        FileOp.op_checkPathPresent('/glorch')
      );
      await assert.isFulfilled(file.transact(checkSpec));
    });
  });

  describe('op deletePathPrefix', () => {
    it('should succeed in deleting the indicated path (it counts as a prefix)', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.create();
      await file.transact(new TransactionSpec(FileOp.op_writePath('/bakery', blob)));

      const spec = new TransactionSpec(FileOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(FileOp.op_checkPathAbsent('/bakery'));
      await assert.isFulfilled(file.transact(checkSpec));
    });

    it('should succeed in deleting the indicated prefix', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.create();
      await file.transact(new TransactionSpec(
        FileOp.op_writePath('/bakery/biscuit', blob),
        FileOp.op_writePath('/bakery/muffin', blob),
        FileOp.op_writePath('/bakery/british/scone', blob)
      ));

      const spec = new TransactionSpec(FileOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        FileOp.op_checkPathAbsent('/bakery/biscuit'),
        FileOp.op_checkPathAbsent('/bakery/muffin'),
        FileOp.op_checkPathAbsent('/bakery/british/scone'),
      );
      await assert.isFulfilled(file.transact(checkSpec));
    });

    it('should succeed even if the path or prefix is not present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(FileOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));
    });

    it('should not affect non-prefix paths', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.create();
      await file.transact(new TransactionSpec(
        FileOp.op_writePath('/bakery/muffin', blob),
        FileOp.op_writePath('/bakeryx', blob),
        FileOp.op_writePath('/baker', blob)
      ));

      const spec = new TransactionSpec(FileOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        FileOp.op_checkPathAbsent('/bakery/muffin'),
        FileOp.op_checkPathPresent('/bakeryx'),
        FileOp.op_checkPathPresent('/baker')
      );
      await assert.isFulfilled(file.transact(checkSpec));
    });
  });

  describe('op deletePathRange', () => {
    it('should succeed in deleting all in-range paths that are present', async () => {
      const blob = new FrozenBuffer('Woo!');
      const origPaths = [
        '/x/a', '/x/yahhhssss', '/foo/1', '/foo/2', '/foo/10', '/foo/11', '/foo/12'
      ];
      const writeSpec = new TransactionSpec(...origPaths.map(p => FileOp.op_writePath(p, blob)));

      async function test(start, end, expectDeleted) {
        const file = new LocalFile('0', TempFiles.uniquePath());
        await file.create();
        await file.transact(writeSpec);

        const spec = new TransactionSpec(FileOp.op_deletePathRange('/foo', start, end));
        await assert.isFulfilled(file.transact(spec));

        const expectPaths = new Set(origPaths);
        for (const p of expectDeleted) {
          expectPaths.delete(`/foo/${p}`);
        }

        const expectSpec = new TransactionSpec(
          FileOp.op_listPathPrefix('/foo'),
          FileOp.op_listPathPrefix('/x'));
        const result = await file.transact(expectSpec);

        assert.sameMembers([...result.paths], [...expectPaths]);
      }

      await test(1, 2, [1]);
      await test(0, 2, [1]);

      await test(2, 3, [2]);
      await test(1, 3, [1, 2]);
      await test(0, 3, [1, 2]);
      await test(0, 4, [1, 2]);

      await test(2, 10, [2]);
      await test(2, 11, [2, 10]);
      await test(2, 12, [2, 10, 11]);
      await test(2, 13, [2, 10, 11, 12]);
      await test(2, 14, [2, 10, 11, 12]);
      await test(3, 14, [10, 11, 12]);
    });

    it('should succeed with an empty result given a range with no matching paths', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      async function test(start, end) {
        const spec = new TransactionSpec(FileOp.op_readPathRange('/florp', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.strictEqual(transactionResult.data.size, 0);
      }

      await test(0, 1);
      await test(0, 2);
      await test(100, 123);
    });

    it('should succeed with an empty result given an empty range', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      async function test(start, end) {
        const spec = new TransactionSpec(FileOp.op_readPathRange('/florp', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.strictEqual(transactionResult.data.size, 0);
      }

      await test(0, 0);
      await test(12, 12);
      await test(10, 9);
      await test(5, 0);
    });
  });

  describe('op listPathPrefix', () => {
    it('should return an empty set when no results are found', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      const spec = new TransactionSpec(FileOp.op_listPathPrefix('/blort'));
      const result = await file.transact(spec);
      assert.instanceOf(result.paths, Set);
      assert.strictEqual(result.paths.size, 0);
    });

    it('should return a single result for the path itself when bound', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      let spec = new TransactionSpec(
        FileOp.op_writePath('/yep', new FrozenBuffer('yep')),
        FileOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(FileOp.op_listPathPrefix('/yep'));
      const result = await file.transact(spec);
      const paths = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 1);
      assert.isTrue(paths.has('/yep'));
    });

    it('should return a single result immediately under the path', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      let spec = new TransactionSpec(
        FileOp.op_writePath('/blort/yep', new FrozenBuffer('yep')),
        FileOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(FileOp.op_listPathPrefix('/blort'));
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

      spec = new TransactionSpec(FileOp.op_listPathPrefix('/blort'));
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

      spec = new TransactionSpec(FileOp.op_listPathPrefix('/blort/x'));
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

  describe('op readPathRange', () => {
    it('should succeed in reading all in-range paths that are present', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Woo!');
      await file.create();
      await file.transact(new TransactionSpec(
        FileOp.op_writePath('/foo/1', blob),
        FileOp.op_writePath('/foo/2', blob),
        FileOp.op_writePath('/foo/10', blob),
        FileOp.op_writePath('/foo/11', blob),
        FileOp.op_writePath('/foo/12', blob)
      ));

      async function test(start, end, expectPaths) {
        const spec = new TransactionSpec(FileOp.op_readPathRange('/foo', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.hasAllKeys(transactionResult.data, expectPaths);
      }

      await test(1, 2, ['/foo/1']);
      await test(0, 2, ['/foo/1']);

      await test(2, 3, ['/foo/2']);
      await test(1, 3, ['/foo/1', '/foo/2']);
      await test(0, 3, ['/foo/1', '/foo/2']);
      await test(0, 4, ['/foo/1', '/foo/2']);

      await test(2, 10, ['/foo/2']);
      await test(2, 11, ['/foo/2', '/foo/10']);
      await test(2, 12, ['/foo/2', '/foo/10', '/foo/11']);
      await test(2, 13, ['/foo/2', '/foo/10', '/foo/11', '/foo/12']);
      await test(2, 14, ['/foo/2', '/foo/10', '/foo/11', '/foo/12']);
      await test(3, 14, ['/foo/10', '/foo/11', '/foo/12']);
    });

    it('should succeed with an empty result given a range with no matching paths', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      async function test(start, end) {
        const spec = new TransactionSpec(FileOp.op_readPathRange('/florp', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.strictEqual(transactionResult.data.size, 0);
      }

      await test(0, 1);
      await test(0, 2);
      await test(100, 123);
    });

    it('should succeed with an empty result given an empty range', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      await file.create();

      async function test(start, end) {
        const spec = new TransactionSpec(FileOp.op_readPathRange('/florp', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.strictEqual(transactionResult.data.size, 0);
      }

      await test(0, 0);
      await test(12, 12);
      await test(10, 9);
      await test(5, 0);
    });
  });

  describe('op writeBlob', () => {
    it('should succeed in writing a blob', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Puffins are now dinosaurs.');
      await file.create();

      const spec = new TransactionSpec(FileOp.op_writeBlob(blob));
      await assert.isFulfilled(file.transact(spec));
    });

    it('should succeed in writing an already-present blob', async () => {
      const file = new LocalFile('0', TempFiles.uniquePath());
      const blob = new FrozenBuffer('Puffins are now dinosaurs.');
      await file.create();

      const spec = new TransactionSpec(FileOp.op_writeBlob(blob));
      await assert.isFulfilled(file.transact(spec));
      await assert.isFulfilled(file.transact(spec));
    });
  });
});
