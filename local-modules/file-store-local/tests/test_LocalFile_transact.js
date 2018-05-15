// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TransactionOp, TransactionSpec } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

import TempFiles from './TempFiles';

describe('file-store-local/LocalFile.transact', () => {
  it('should throw an error if the file doesn\'t exist', async () => {
    const file = TempFiles.makeFile();
    assert.isFalse(await file.exists()); // Baseline assumption.

    // The actual test.
    const spec = new TransactionSpec();
    await assert.isRejected(file.transact(spec));

    await TempFiles.doneWithFile(file);
  });

  it('should succeed and return no data from an empty transaction on an existing file', async () => {
    const file = await TempFiles.makeAndCreateFile();

    const spec   = new TransactionSpec();
    const result = await file.transact(spec);
    assert.strictEqual(result.revNum, 0);
    assert.isUndefined(result.newRevNum);
    assert.isUndefined(result.data);

    await TempFiles.doneWithFile(file);
  });

  describe('op checkBlobAbsent', () => {
    it('should succeed when the blob is absent', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(
        TransactionOp.op_checkBlobAbsent(new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      await TempFiles.doneWithFile(file);
    });

    it('should fail when the blob is present', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Likes are now florps.');
      await file.transact(new TransactionSpec(TransactionOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(TransactionOp.op_checkBlobAbsent(blob));
      await assert.isRejected(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op checkBlobPresent', () => {
    it('should succeed when the blob is present', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Likes are now florps.');
      await file.transact(new TransactionSpec(TransactionOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(TransactionOp.op_checkBlobPresent(blob));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });

    it('should fail when the blob is absent', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(
        TransactionOp.op_checkBlobPresent(new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isRejected(resultProm);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op checkPathIs', () => {
    it('should succeed when the path is present and content matches', async () => {
      const file = await TempFiles.makeAndCreateFile();
      await file.transact(
        new TransactionSpec(TransactionOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathIs('/blort', new FrozenBuffer('blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 1);

      await TempFiles.doneWithFile(file);
    });

    it('should fail when the path is not present at all', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathIs('/blort', new FrozenBuffer('anything')));
      await assert.isRejected(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });

    it('should fail when the path is present and content does not match', async () => {
      const file = await TempFiles.makeAndCreateFile();
      await file.transact(
        new TransactionSpec(TransactionOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathIs('/blort', new FrozenBuffer('not-blort')));
      await assert.isRejected(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op checkPathNot', () => {
    it('should succeed when the path is not present at all', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathNot('/blort', new FrozenBuffer('anything')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 0);

      await TempFiles.doneWithFile(file);
    });

    it('should succeed when the path is present and content does not match', async () => {
      const file = await TempFiles.makeAndCreateFile();
      await file.transact(
        new TransactionSpec(TransactionOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathNot('/blort', new FrozenBuffer('not-blort')));
      const resultProm = file.transact(spec);
      await assert.isFulfilled(resultProm);

      const result = await resultProm;
      assert.strictEqual(result.revNum, 1);

      await TempFiles.doneWithFile(file);
    });

    it('should fail when the path is present and content matches', async () => {
      const file = await TempFiles.makeAndCreateFile();
      await file.transact(
        new TransactionSpec(TransactionOp.op_writePath('/blort', new FrozenBuffer('blort'))));

      const spec = new TransactionSpec(
        TransactionOp.op_checkPathNot('/blort', new FrozenBuffer('blort')));
      await assert.isRejected(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op deleteBlob', () => {
    it('should succeed in deleting the indicated blob', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.transact(new TransactionSpec(TransactionOp.op_writeBlob(blob)));

      const spec = new TransactionSpec(TransactionOp.op_deleteBlob(blob));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(TransactionOp.op_checkBlobAbsent(blob));
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });

    it('should succeed even if the blob is not present', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Timeline goes sideways.');

      const spec = new TransactionSpec(TransactionOp.op_deleteBlob(blob));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op deletePath', () => {
    it('should succeed in deleting the indicated path', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.transact(new TransactionSpec(TransactionOp.op_writePath('/florp', blob)));

      const spec = new TransactionSpec(TransactionOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(TransactionOp.op_checkPathAbsent('/florp'));
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });

    it('should succeed even if the path is not present', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(TransactionOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });

    it('should not affect non-listed paths', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Timeline goes sideways.');
      await file.transact(new TransactionSpec(
        TransactionOp.op_writePath('/florp', blob),
        TransactionOp.op_writePath('/blort', blob),
        TransactionOp.op_writePath('/glorch', blob)
      ));

      const spec = new TransactionSpec(TransactionOp.op_deletePath('/florp'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        TransactionOp.op_checkPathAbsent('/florp'),
        TransactionOp.op_checkPathPresent('/blort'),
        TransactionOp.op_checkPathPresent('/glorch')
      );
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op deletePathPrefix', () => {
    it('should succeed in deleting the indicated path (it counts as a prefix)', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.transact(new TransactionSpec(TransactionOp.op_writePath('/bakery', blob)));

      const spec = new TransactionSpec(TransactionOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(TransactionOp.op_checkPathAbsent('/bakery'));
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });

    it('should succeed in deleting the indicated prefix', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.transact(new TransactionSpec(
        TransactionOp.op_writePath('/bakery/biscuit', blob),
        TransactionOp.op_writePath('/bakery/muffin', blob),
        TransactionOp.op_writePath('/bakery/british/scone', blob)
      ));

      const spec = new TransactionSpec(TransactionOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        TransactionOp.op_checkPathAbsent('/bakery/biscuit'),
        TransactionOp.op_checkPathAbsent('/bakery/muffin'),
        TransactionOp.op_checkPathAbsent('/bakery/british/scone'),
      );
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });

    it('should succeed even if the path or prefix is not present', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(TransactionOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });

    it('should not affect non-prefix paths', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Muffins are tasty.');
      await file.transact(new TransactionSpec(
        TransactionOp.op_writePath('/bakery/muffin', blob),
        TransactionOp.op_writePath('/bakeryx', blob),
        TransactionOp.op_writePath('/baker', blob)
      ));

      const spec = new TransactionSpec(TransactionOp.op_deletePathPrefix('/bakery'));
      await assert.isFulfilled(file.transact(spec));

      const checkSpec = new TransactionSpec(
        TransactionOp.op_checkPathAbsent('/bakery/muffin'),
        TransactionOp.op_checkPathPresent('/bakeryx'),
        TransactionOp.op_checkPathPresent('/baker')
      );
      await assert.isFulfilled(file.transact(checkSpec));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op deletePathRange', () => {
    it('should succeed in deleting all in-range paths that are present', async () => {
      const blob = new FrozenBuffer('Woo!');
      const origPaths = [
        '/x/a', '/x/yahhhssss', '/foo/1', '/foo/2', '/foo/10', '/foo/11', '/foo/12'
      ];
      const writeSpec = new TransactionSpec(...origPaths.map(p => TransactionOp.op_writePath(p, blob)));

      async function test(start, end, expectDeleted) {
        const file = await TempFiles.makeAndCreateFile();
        await file.transact(writeSpec);

        const spec = new TransactionSpec(TransactionOp.op_deletePathRange('/foo', start, end));
        await assert.isFulfilled(file.transact(spec));

        const expectPaths = new Set(origPaths);
        for (const p of expectDeleted) {
          expectPaths.delete(`/foo/${p}`);
        }

        const expectSpec = new TransactionSpec(
          TransactionOp.op_listPathPrefix('/foo'),
          TransactionOp.op_listPathPrefix('/x'));
        const result = await file.transact(expectSpec);

        assert.sameMembers([...result.paths], [...expectPaths]);

        await TempFiles.doneWithFile(file);
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

    it('should succeed and do nothing given a range with no matching paths', async () => {
      const blob = new FrozenBuffer('Woo!');
      const origPaths = [
        '/x/a', '/x/yahhhssss', '/foo/1', '/foo/2', '/foo/10', '/foo/11', '/foo/12'
      ];
      const file = await TempFiles.makeAndCreateFile();
      await file.transact(
        new TransactionSpec(...origPaths.map(p => TransactionOp.op_writePath(p, blob))));

      async function test(start, end) {
        const spec = new TransactionSpec(TransactionOp.op_deletePathRange('/foo', start, end));
        await assert.isFulfilled(file.transact(spec));

        const expectSpec = new TransactionSpec(
          TransactionOp.op_listPathPrefix('/foo'),
          TransactionOp.op_listPathPrefix('/x'));
        const result = await file.transact(expectSpec);

        assert.sameMembers([...result.paths], origPaths);
      }

      await test(0, 1);
      await test(3, 8);
      await test(100, 123);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op listPathPrefix', () => {
    it('should return an empty set when no results are found', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec = new TransactionSpec(TransactionOp.op_listPathPrefix('/blort'));
      const result = await file.transact(spec);
      assert.instanceOf(result.paths, Set);
      assert.strictEqual(result.paths.size, 0);

      await TempFiles.doneWithFile(file);
    });

    it('should return a single result for the path itself when bound', async () => {
      const file = await TempFiles.makeAndCreateFile();

      let spec = new TransactionSpec(
        TransactionOp.op_writePath('/yep', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(TransactionOp.op_listPathPrefix('/yep'));
      const result = await file.transact(spec);
      const paths  = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 1);
      assert.isTrue(paths.has('/yep'));

      await TempFiles.doneWithFile(file);
    });

    it('should return a single result immediately under the path', async () => {
      const file = await TempFiles.makeAndCreateFile();

      let spec = new TransactionSpec(
        TransactionOp.op_writePath('/blort/yep', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(TransactionOp.op_listPathPrefix('/blort'));
      const result = await file.transact(spec);
      const paths  = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 1);
      assert.isTrue(paths.has('/blort/yep'));

      await TempFiles.doneWithFile(file);
    });

    it('should return a single result immediately under the path, even if the full result path has more components', async () => {
      const file = await TempFiles.makeAndCreateFile();

      let spec = new TransactionSpec(
        TransactionOp.op_writePath('/blort/yep/nope', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/nope', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(TransactionOp.op_listPathPrefix('/blort'));
      const result = await file.transact(spec);
      const paths  = result.paths;

      assert.instanceOf(paths, Set);
      assert.sameMembers([...paths.values()], ['/blort/yep']);

      await TempFiles.doneWithFile(file);
    });

    it('should return multiple results properly', async () => {
      const file = await TempFiles.makeAndCreateFile();

      let spec = new TransactionSpec(
        TransactionOp.op_writePath('/abraxas/1/2/3', new FrozenBuffer('nope')),
        TransactionOp.op_writePath('/blort/nope', new FrozenBuffer('nope')),
        TransactionOp.op_writePath('/blort/x/affirmed', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/blort/x/definitely/a/b/c', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/blort/x/definitely/d/e/f', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/blort/x/yep/1', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/blort/x/yep/2', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/blort/x/yep/3', new FrozenBuffer('yep')),
        TransactionOp.op_writePath('/nope', new FrozenBuffer('nope')),
        TransactionOp.op_writePath('/nope/blort', new FrozenBuffer('nope'))
      );
      await file.transact(spec);

      spec = new TransactionSpec(TransactionOp.op_listPathPrefix('/blort/x'));
      const result = await file.transact(spec);
      const paths  = result.paths;

      assert.instanceOf(paths, Set);
      assert.strictEqual(paths.size, 3);
      assert.isTrue(paths.has('/blort/x/yep'));
      assert.isTrue(paths.has('/blort/x/affirmed'));
      assert.isTrue(paths.has('/blort/x/definitely'));

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op listPathRange', () => {
    it('should return an empty set when no results are found', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const spec   = new TransactionSpec(TransactionOp.op_listPathRange('/blort', 10, 20));
      const result = await file.transact(spec);
      assert.instanceOf(result.paths, Set);
      assert.strictEqual(result.paths.size, 0);

      await TempFiles.doneWithFile(file);
    });

    it('should return all in-range paths', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Woo!');
      await file.transact(new TransactionSpec(
        TransactionOp.op_writePath('/boop', blob),
        TransactionOp.op_writePath('/foo/florp', blob),
        TransactionOp.op_writePath('/foo/1', blob),
        TransactionOp.op_writePath('/foo/2', blob),
        TransactionOp.op_writePath('/foo/10', blob),
        TransactionOp.op_writePath('/foo/11', blob),
        TransactionOp.op_writePath('/foo/12', blob)
      ));

      async function test(start, end, expectPaths) {
        const spec = new TransactionSpec(TransactionOp.op_listPathRange('/foo', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.sameMembers([...transactionResult.paths], expectPaths);
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

      await test(100, 110, []);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op readBlob', () => {
    it('should succeed in reading a blob that is in the file', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Muffins are now biscuits.');
      await file.transact(new TransactionSpec(TransactionOp.op_writeBlob(blob)));

      // The reading is based on the hash of `blob`, so it's irrelevant that
      // the given argument is actually the content in question.
      const spec = new TransactionSpec(TransactionOp.op_readBlob(blob));
      const transactionResult = await assert.isFulfilled(file.transact(spec));

      assert.strictEqual(transactionResult.data.get(blob.hash), blob);

      await TempFiles.doneWithFile(file);
    });

    it('should succeed even if the blob is not present', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Muffins are now biscuits.');

      const spec = new TransactionSpec(TransactionOp.op_readBlob(blob));
      const transactionResult = await assert.isFulfilled(file.transact(spec));

      assert.strictEqual(transactionResult.data.size, 0);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op readPathRange', () => {
    it('should succeed in reading all in-range paths that are present', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Woo!');
      await file.transact(new TransactionSpec(
        TransactionOp.op_writePath('/frotz', blob),
        TransactionOp.op_writePath('/foo/florp', blob),
        TransactionOp.op_writePath('/foo/1', blob),
        TransactionOp.op_writePath('/foo/2', blob),
        TransactionOp.op_writePath('/foo/10', blob),
        TransactionOp.op_writePath('/foo/11', blob),
        TransactionOp.op_writePath('/foo/12', blob)
      ));

      async function test(start, end, expectPaths) {
        const spec = new TransactionSpec(TransactionOp.op_readPathRange('/foo', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        if (expectPaths.length === 0) {
          assert.isEmpty(transactionResult.data);
        } else {
          assert.hasAllKeys(transactionResult.data, expectPaths);
        }
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

      await test(100, 110, []);

      await TempFiles.doneWithFile(file);
    });

    it('should succeed with an empty result given a range with no matching paths', async () => {
      const file = await TempFiles.makeAndCreateFile();

      async function test(start, end) {
        const spec = new TransactionSpec(TransactionOp.op_readPathRange('/florp', start, end));
        const transactionResult = await assert.isFulfilled(file.transact(spec));

        assert.strictEqual(transactionResult.data.size, 0);
      }

      await test(0, 1);
      await test(0, 2);
      await test(100, 123);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('op writeBlob', () => {
    it('should succeed in writing a blob', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Puffins are now dinosaurs.');

      const spec = new TransactionSpec(TransactionOp.op_writeBlob(blob));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });

    it('should succeed in writing an already-present blob', async () => {
      const file = await TempFiles.makeAndCreateFile();
      const blob = new FrozenBuffer('Puffins are now dinosaurs.');

      const spec = new TransactionSpec(TransactionOp.op_writeBlob(blob));
      await assert.isFulfilled(file.transact(spec));
      await assert.isFulfilled(file.transact(spec));

      await TempFiles.doneWithFile(file);
    });
  });
});
