// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { FileChange, FileOp, FileSnapshot } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

import { TempFiles } from './TempFiles';

describe('@bayou/file-store-local/LocalFile', () => {
  describe('constructor()', () => {
    it('does not throw given valid arguments', () => {
      assert.doesNotThrow(() => { TempFiles.makeFile(); });
    });
  });

  describe('appendChange()', () => {
    it('loses the append race on an existing revision number', async () => {
      const file  = await TempFiles.makeAndCreateFile();
      const value = FrozenBuffer.coerce('x');

      // This should lose the race (return `false`) because `create()` writes
      // change #0.
      assert.isFalse(await file.appendChange(FileChange.FIRST));

      // Append change #1 twice. First should succeed. Second should lose.

      const change1 = new FileChange(1, [FileOp.op_writePath('/x', value)]);
      assert.isTrue(await file.appendChange(change1));
      assert.isFalse(await file.appendChange(change1));
    });

    it('fails with an error when given a `revNum` more than one past the end', async () => {
      const file  = await TempFiles.makeAndCreateFile();
      const value = FrozenBuffer.coerce('x');

      for (let revNum = 2; revNum < 1000; revNum = (revNum * 2) + 123) {
        const change = new FileChange(revNum, [FileOp.op_writePath('/x', value)]);
        await assert.isRejected(file.appendChange(change), /badValue/, `revNum ${revNum}`);
      }
    });
  });

  describe('create()', () => {
    it('causes a non-existent file to come into existence', async () => {
      const file = TempFiles.makeFile();

      assert.isFalse(await file.exists()); // Baseline assumption.
      await file.create();

      assert.isTrue(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });

    it('causes a non-existent file to have one change with the expected contents', async () => {
      const file = TempFiles.makeFile();

      await file.create();

      const revNum = await file.currentRevNum();
      assert.strictEqual(revNum, 0);

      const snap = await file.getSnapshot(0);
      assert.strictEqual(snap.size, 0);

      const change = await file.getChange(0);
      assert.deepEqual(change, FileChange.FIRST);

      await TempFiles.doneWithFile(file);
    });

    it('does nothing if called on a non-empty file', async () => {
      const file        = await TempFiles.makeAndCreateFile();
      const storagePath = '/abc';
      const value       = FrozenBuffer.coerce('x');

      // Baseline setup / assumption.

      const change1 = new FileChange(1, [FileOp.op_writePath(storagePath, value)]);
      await file.appendChange(change1);

      assert.isTrue(await file.exists());

      const snap1 = await file.getSnapshot();
      assert.deepEqual(snap1.getOrNull(storagePath), value);

      // The real test.

      await assert.isFulfilled(file.create());

      // Ensure the file exists and that the path that was written is still
      // there.

      assert.isTrue(await file.exists());

      const snap2 = await file.getSnapshot();

      assert.deepEqual(snap2.getOrNull(storagePath), value);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('delete()', () => {
    it('causes an existing file to stop existing', async () => {
      const file = await TempFiles.makeAndCreateFile();
      assert.isTrue(await file.exists()); // Baseline assumption.

      await file.delete();
      assert.isFalse(await file.exists()); // The actual test.

      await TempFiles.doneWithFile(file);
    });
  });

  describe('exists()', () => {
    it('returns `false` if the underlying storage does not exist', async () => {
      const file = TempFiles.makeFile();
      assert.isFalse(await file.exists());

      await TempFiles.doneWithFile(file);
    });

    it('returns `true` if the file was created in the filesystem', async () => {
      const dir   = TempFiles.uniquePath();
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

  describe('getChange()', () => {
    it('successfully gets an existing change', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const got0 = await file.getChange(0);
      assert.instanceOf(got0, FileChange);
      assert.deepEqual(got0, FileChange.FIRST);

      const storagePath = '/boop/beep';
      const value       = FrozenBuffer.coerce('floop-fleep');
      const change1     = new FileChange(1, [FileOp.op_writePath(storagePath, value)]);
      assert.isTrue(await file.appendChange(change1));

      const got1 = await file.getChange(1);
      assert.instanceOf(got1, FileChange);
      assert.deepEqual(got1, change1);

      await TempFiles.doneWithFile(file);
    });

    it('reports an error given a future `revNum`', async () => {
      const file = await TempFiles.makeAndCreateFile();

      assert.isRejected(file.getChange(1), /badValue/);

      await TempFiles.doneWithFile(file);
    });
  });

  describe('getSnapshot()', () => {
    it('successfully gets the current snapshot', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const got0 = await file.getSnapshot(0);
      assert.instanceOf(got0, FileSnapshot);
      assert.strictEqual(got0.size, 0);

      const path1   = '/hello/there';
      const value1  = FrozenBuffer.coerce('yo');
      const change1 = new FileChange(1, [FileOp.op_writePath(path1, value1)]);
      assert.isTrue(await file.appendChange(change1));

      const got1 = await file.getSnapshot(1);
      assert.instanceOf(got1, FileSnapshot);
      assert.deepEqual(got1.getOrNull(path1), value1);

      const path2   = '/hello_again';
      const value2  = FrozenBuffer.coerce('yoyo');
      const change2 = new FileChange(2, [FileOp.op_writePath(path2, value2)]);
      assert.isTrue(await file.appendChange(change2));

      const got2 = await file.getSnapshot(2);
      assert.instanceOf(got1, FileSnapshot);
      assert.deepEqual(got2.getOrNull(path2), value2);

      await TempFiles.doneWithFile(file);
    });

    it('successfully reflects a path replacement in the current snapshot', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const path    = '/hello/there';
      const value1  = FrozenBuffer.coerce('yo');
      const value2  = FrozenBuffer.coerce('oh-ho!');
      const change1 = new FileChange(1, [FileOp.op_writePath(path, value1)]);
      const change2 = new FileChange(2, [FileOp.op_writePath(path, value2)]);
      assert.isTrue(await file.appendChange(change1));
      assert.isTrue(await file.appendChange(change2));

      const got2 = await file.getSnapshot(2);
      assert.instanceOf(got2, FileSnapshot);
      assert.deepEqual(got2.getOrNull(path), value2);

      await TempFiles.doneWithFile(file);
    });

    it('successfully reflects a path deletion in the current snapshot', async () => {
      const file = await TempFiles.makeAndCreateFile();

      const path    = '/hello/there';
      const value   = FrozenBuffer.coerce('yo');
      const change1 = new FileChange(1, [FileOp.op_writePath(path, value)]);
      const change2 = new FileChange(2, [FileOp.op_deletePath(path)]);
      assert.isTrue(await file.appendChange(change1));
      assert.isTrue(await file.appendChange(change2));

      const got2 = await file.getSnapshot(2);
      assert.instanceOf(got2, FileSnapshot);
      assert.isNull(got2.getOrNull(path));

      await TempFiles.doneWithFile(file);
    });

    it('successfully reflects all-path deletion in the current snapshot', async () => {
      const file  = await TempFiles.makeAndCreateFile();
      const value = FrozenBuffer.coerce('yo');

      for (let i = 1; i <= 10; i++) {
        const path   = `/x/${i}`;
        const change = new FileChange(i, [FileOp.op_writePath(path, value)]);
        assert.isTrue(await file.appendChange(change));
      }

      const change11 = new FileChange(11, [FileOp.op_deleteAll()]);
      assert.isTrue(await file.appendChange(change11));

      const got11 = await file.getSnapshot(11);
      assert.instanceOf(got11, FileSnapshot);
      assert.strictEqual(got11.size, 0);

      await TempFiles.doneWithFile(file);
    });

    it('reports an error given a future `revNum`', async () => {
      const file = await TempFiles.makeAndCreateFile();

      assert.isRejected(file.getSnapshot(1), /badValue/);

      await TempFiles.doneWithFile(file);
    });
  });
});
