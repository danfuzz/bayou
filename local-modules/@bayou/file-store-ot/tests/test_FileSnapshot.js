// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { FileChange, FileDelta, FileOp, FileSnapshot } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

describe('@bayou/file-store-ot/FileSnapshot', () => {
  describe('.EMPTY', () => {
    it('should be an empty instance', () => {
      const EMPTY = FileSnapshot.EMPTY;

      assert.strictEqual(EMPTY.revNum, 0);
      assert.strictEqual(EMPTY.size, 0);
      assert.isFrozen(EMPTY);
    });
  });

  describe('constructor()', () => {
    describe('valid ops arrays and deltas', () => {
      const values = [
        [],
        [FileOp.op_writeBlob(FrozenBuffer.coerce('florp'))],
        [
          FileOp.op_writeBlob(FrozenBuffer.coerce('florp')),
          FileOp.op_writeBlob(FrozenBuffer.coerce('like')),
          FileOp.op_writeBlob(FrozenBuffer.coerce('zorch'))
        ],
        [FileOp.op_writePath('/zorch', FrozenBuffer.coerce('splat'))],
        [
          FileOp.op_writePath('/zorch/1', FrozenBuffer.coerce('splat1')),
          FileOp.op_writePath('/zorch/2', FrozenBuffer.coerce('splat2')),
          FileOp.op_writePath('/zorch/3', FrozenBuffer.coerce('splat3'))
        ],
      ];

      for (const v of values) {
        it(`should succeed for array: ${inspect(v)}`, () => {
          new FileSnapshot(0, v);
        });

        it(`should succeed for delta: ${inspect(v)}`, () => {
          new FileSnapshot(0, new FileDelta(v));
        });
      }
    });

    it('should accept valid revision numbers', () => {
      function test(value) {
        new FileSnapshot(value, FileDelta.EMPTY);
      }

      test(0);
      test(1);
      test(999999);
    });

    it('should produce a frozen instance', () => {
      const snap = new FileSnapshot(0, [FileOp.op_writePath('/x', FrozenBuffer.coerce('y'))]);
      assert.isFrozen(snap);
    });

    it('should reject an array or delta that is not all valid ops', () => {
      function test(value) {
        assert.throws(() => { new FileSnapshot(0, value); });

        // *If* `value` can be constructed into a delta, then try making a
        // snapshot with it. If not, ignore the error as it's not salient here.
        try {
          const delta = new FileDelta(value);
          assert.throws(() => { new FileSnapshot(0, delta); });
        } catch (e) {
          // Ignore, per above.
        }
      }

      const buf = FrozenBuffer.coerce('foobar');

      // Non-ops.
      test([1]);
      test([
        'florp',
        FileOp.op_writeBlob(buf)
      ]);

      // Deletes aren't allowed.
      test([FileOp.op_deleteAll()]);
      test([FileOp.op_deleteBlob(buf.hash)]);
      test([FileOp.op_deletePath('/x')]);
      test([
        FileOp.op_writePath('/x', buf),
        FileOp.op_deletePath('/zorch')
      ]);

      // Duplicate names aren't allowed.
      test([
        FileOp.op_writePath('/x', buf),
        FileOp.op_writePath('/x', buf)
      ]);
    });

    it('should reject invalid revision numbers', () => {
      function test(value) {
        assert.throws(() => { new FileSnapshot(value, FileDelta.EMPTY); });
      }

      test(-1);
      test(1.5);
      test(null);
      test(false);
      test(undefined);
      test([]);
      test([789]);
      test({ a: 10 });
    });
  });

  describe('.size', () => {
    it('should indicate the count of bound IDs', () => {
      function test(ops) {
        const snap = new FileSnapshot(1, ops);
        assert.strictEqual(snap.size, ops.length);
      }

      const buf1 = FrozenBuffer.coerce('one');
      const buf2 = FrozenBuffer.coerce('two');

      test([]);
      test([FileOp.op_writeBlob(buf1)]);
      test([
        FileOp.op_writeBlob(buf1),
        FileOp.op_writeBlob(buf2)
      ]);
      test([FileOp.op_writePath('/x', buf1)]);
      test([
        FileOp.op_writePath('/x', buf1),
        FileOp.op_writePath('/z', buf2)
      ]);
      test([
        FileOp.op_writePath('/x/x/x',   buf1),
        FileOp.op_writePath('/z/123',   buf1),
        FileOp.op_writePath('/florp/x', buf1),
        FileOp.op_writeBlob(buf1)
      ]);
    });
  });

  describe('diff()', () => {
    it('should produce an empty diff when passed itself', () => {
      const buf  = FrozenBuffer.coerce('oh yeah');
      const snap = new FileSnapshot(914,
        [FileOp.op_writePath('/a', buf), FileOp.op_writePath('/b', buf)]);
      const result = snap.diff(snap);

      assert.instanceOf(result, FileChange);
      assert.strictEqual(result.revNum, 914);
      assert.deepEqual(result.delta, FileDelta.EMPTY);
    });

    it('should result in a `revNum` diff if that in fact changes', () => {
      const buf    = FrozenBuffer.coerce('oh yeah');
      const snap1  = new FileSnapshot(123, [FileOp.op_writePath('/a', buf)]);
      const snap2  = new FileSnapshot(456, [FileOp.op_writePath('/a', buf)]);
      const result = snap1.diff(snap2);

      const composed = new FileSnapshot(0, []).compose(result);
      const expected = new FileSnapshot(456, FileDelta.EMPTY);
      assert.strictEqual(composed.revNum, 456);
      assert.isTrue(composed.equals(expected));
    });

    it('should result in a path removal if that in fact happens', () => {
      const buf   = FrozenBuffer.coerce('oh yeah');
      const snap1 = new FileSnapshot(0, [
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/b', buf),
        FileOp.op_writePath('/c', buf)
      ]);
      const snap2 = new FileSnapshot(0, [
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/c', buf)
      ]);
      const result = snap1.diff(snap2);

      const composed = snap1.compose(result);
      assert.isTrue(composed.equals(snap2));
    });

    it('should result in a blob removal if that in fact happens', () => {
      const buf1  = FrozenBuffer.coerce('oh yeah');
      const buf2  = FrozenBuffer.coerce('oh no');
      const buf3  = FrozenBuffer.coerce('oh wha?!');
      const snap1 = new FileSnapshot(0, [
        FileOp.op_writeBlob(buf1),
        FileOp.op_writeBlob(buf2),
        FileOp.op_writeBlob(buf3)
      ]);
      const snap2 = new FileSnapshot(0, [
        FileOp.op_writeBlob(buf1),
        FileOp.op_writeBlob(buf3)
      ]);
      const result = snap1.diff(snap2);

      const composed = snap1.compose(result);
      assert.isTrue(composed.equals(snap2));
    });
  });

  describe('entries()', () => {
    it('should return an iterator', () => {
      const snap   = new FileSnapshot(0, []);
      const result = snap.entries();

      assert.isFunction(result.next);

      // Iterators are supposed to return themselves from `[Symbol.iterator]()`.
      assert.isFunction(result[Symbol.iterator]);
      assert.strictEqual(result[Symbol.iterator](), result);
    });

    it('should in fact iterate over the storage IDs', () => {
      function test(ops) {
        // Expectations as a map of keys to values.
        const expectMap = new Map();
        for (const op of ops) {
          const props = op.props;
          if (props.path) {
            expectMap.set(props.path, props.blob);
          } else {
            expectMap.set(props.blob.hash, props.blob);
          }
        }

        const snap = new FileSnapshot(1, ops);
        for (const [id, value] of snap.entries()) {
          assert.isTrue(expectMap.has(id));
          assert.strictEqual(value, expectMap.get(id));
          expectMap.delete(id);
        }

        assert.strictEqual(expectMap.size, 0, 'All IDs accounted for.');
      }

      const buf1 = FrozenBuffer.coerce('oh yeah');
      const buf2 = FrozenBuffer.coerce('oh no');
      const buf3 = FrozenBuffer.coerce('oh wha?!');

      test([]);
      test([FileOp.op_writeBlob(buf1)]);
      test([FileOp.op_writePath('/x', buf1)]);
      test([
        FileOp.op_writePath('/a', buf1),
        FileOp.op_writePath('/b', buf1)
      ]);
      test([
        FileOp.op_writePath('/a', buf1),
        FileOp.op_writeBlob(buf1)
      ]);
      test([
        FileOp.op_writePath('/a', buf1),
        FileOp.op_writePath('/b', buf1),
        FileOp.op_writePath('/c', buf1),
        FileOp.op_writePath('/d', buf1),
        FileOp.op_writePath('/e', buf1),
        FileOp.op_writePath('/f', buf1),
        FileOp.op_writePath('/g', buf1),
        FileOp.op_writeBlob(buf1),
        FileOp.op_writeBlob(buf2),
        FileOp.op_writeBlob(buf3)
      ]);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      function test(...args) {
        const snap = new FileSnapshot(...args);
        assert.isTrue(snap.equals(snap), inspect(snap));
      }

      const buf = FrozenBuffer.coerce('oh yeah');

      test(0, []);
      test(0, FileDelta.EMPTY);
      test(37, []);
      test(37, FileDelta.EMPTY);
      test(914, [
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/b', buf),
        FileOp.op_writePath('/c', buf)
      ]);
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const snap1 = new FileSnapshot(...args);
        const snap2 = new FileSnapshot(...args);
        const label = inspect(snap1);
        assert.isTrue(snap1.equals(snap2), label);
        assert.isTrue(snap2.equals(snap1), label);
      }

      const buf = FrozenBuffer.coerce('oh yeah');

      test(0, []);
      test(0, FileDelta.EMPTY);
      test(37, []);
      test(37, FileDelta.EMPTY);
      test(914, [
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/b', buf),
        FileOp.op_writePath('/c', buf),
        FileOp.op_writeBlob(buf)
      ]);
    });

    it('should return `true` when identical construction ops are passed in different orders', () => {
      const buf   = FrozenBuffer.coerce('oh yeah');
      const snap1 = new FileSnapshot(321, [
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/b', buf),
        FileOp.op_writePath('/c', buf),
        FileOp.op_writeBlob(buf)
      ]);
      const snap2 = new FileSnapshot(321, [
        FileOp.op_writeBlob(buf),
        FileOp.op_writePath('/b', buf),
        FileOp.op_writePath('/a', buf),
        FileOp.op_writePath('/c', buf),
      ]);

      assert.isTrue(snap1.equals(snap2));
    });

    it('should return `false` when `revNum`s differ', () => {
      const buf   = FrozenBuffer.coerce('oh yeah');
      const snap1 = new FileSnapshot(123, [FileOp.op_writePath('/a', buf)]);
      const snap2 = new FileSnapshot(456, [FileOp.op_writePath('/a', buf)]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when a path value differs', () => {
      const buf1 = FrozenBuffer.coerce('oh yeah 1');
      const buf2 = FrozenBuffer.coerce('oh yeah 2');
      const snap1 = new FileSnapshot(9, [
        FileOp.op_writePath('/a', buf1),
        FileOp.op_writePath('/b', buf1),
        FileOp.op_writePath('/c', buf1)
      ]);
      const snap2 = new FileSnapshot(9, [
        FileOp.op_writePath('/a', buf1),
        FileOp.op_writePath('/b', buf2),
        FileOp.op_writePath('/c', buf1)
      ]);

      assert.isFalse(snap1.equals(snap2));
      assert.isFalse(snap2.equals(snap1));
    });

    it('should return `false` when passed a non-snapshot', () => {
      const snap = FileSnapshot.EMPTY;

      assert.isFalse(snap.equals(undefined));
      assert.isFalse(snap.equals(null));
      assert.isFalse(snap.equals(false));
      assert.isFalse(snap.equals(true));
      assert.isFalse(snap.equals(914));
      assert.isFalse(snap.equals(['not', 'a', 'snapshot']));
      assert.isFalse(snap.equals(new Map()));
    });
  });

  describe('get()', () => {
    it('should return the value associated with an existing ID', () => {
      const buf1 = FrozenBuffer.coerce('oh yeah 1');
      const buf2 = FrozenBuffer.coerce('oh yeah 2');

      function test(path, value) {
        const op1 = FileOp.op_writePath(path, value);
        const op2 = FileOp.op_writeBlob(value);
        const snap = new FileSnapshot(1, [
          FileOp.op_writePath('/a', buf1),
          FileOp.op_writePath('/b', buf2),
          op1,
          op2,
          FileOp.op_writeBlob(buf1),
          FileOp.op_writeBlob(buf2)
        ]);

        assert.strictEqual(snap.get(path), value);
        assert.strictEqual(snap.get(value.hash), value);
      }

      test('/foo/bar', FrozenBuffer.coerce('blorp'));
      test('/x/y/z', FrozenBuffer.coerce('blorp'));
    });

    it('should throw an error when given an unbound storage ID', () => {
      const buf  = FrozenBuffer.coerce('stuff');
      const snap = new FileSnapshot(1, [FileOp.op_writePath('/blort', buf)]);

      assert.throws(() => { snap.get('/not_blort'); });
      assert.throws(() => { snap.get(buf.hash); }); // Not stored as a blob.
    });
  });

  describe('getOrNull()', () => {
    it('should return the value associated with an existing storage ID', () => {
      const buf1 = FrozenBuffer.coerce('oh yeah 1');
      const buf2 = FrozenBuffer.coerce('oh yeah 2');

      function test(path, value) {
        const op1  = FileOp.op_writePath(path, value);
        const op2  = FileOp.op_writeBlob(value);
        const snap = new FileSnapshot(1, [
          FileOp.op_writePath('/a', buf1),
          FileOp.op_writePath('/b', buf2),
          op1,
          op2,
          FileOp.op_writeBlob(buf1),
          FileOp.op_writeBlob(buf2)
        ]);

        assert.strictEqual(snap.getOrNull(path), value);
        assert.strictEqual(snap.getOrNull(value.hash), value);
      }

      test('/foo/bar', FrozenBuffer.coerce('blorp'));
      test('/x/y/z', FrozenBuffer.coerce('blorp'));
    });

    it('should return `null` when given an ID that is not bound', () => {
      const buf  = FrozenBuffer.coerce('stuff');
      const snap = new FileSnapshot(1, [FileOp.op_writePath('/blort', buf)]);

      assert.isNull(snap.getOrNull('/not_blort'));
      assert.isNull(snap.getOrNull(buf.hash)); // Not stored as a blob.
    });
  });

  describe('getPathPrefix', () => {
    it('should retrieve all bindings at or under the indicated prefix', () => {
      const buf1 = new FrozenBuffer('buf1');
      const buf2 = new FrozenBuffer('buf2');
      const buf3 = new FrozenBuffer('buf3');
      const snap = new FileSnapshot(914, [
        FileOp.op_writePath('/a',         buf1),
        FileOp.op_writePath('/d',         buf2),
        FileOp.op_writePath('/d/r',       buf3),
        FileOp.op_writePath('/d/r/b',     buf1),
        FileOp.op_writePath('/d/r/b/1',   buf2),
        FileOp.op_writePath('/d/r/b/2',   buf3),
        FileOp.op_writePath('/d/r/b/x',   buf1),
        FileOp.op_writePath('/d/r/b/y/z', buf2),
        FileOp.op_writePath('/d/rr',      buf3),
        FileOp.op_writePath('/d/s',       buf1),
        FileOp.op_writePath('/e',         buf2),
        FileOp.op_writeBlob(buf1)
      ]);

      const result = snap.getPathPrefix('/d/r');

      assert.instanceOf(result, Map);
      assert.sameDeepMembers([...result.entries()], Object.entries({
        '/d/r':       buf3,
        '/d/r/b':     buf1,
        '/d/r/b/1':   buf2,
        '/d/r/b/2':   buf3,
        '/d/r/b/x':   buf1,
        '/d/r/b/y/z': buf2
      }));
    });

    it('should reject a bogus prefix', () => {
      const snap = FileSnapshot.EMPTY;

      function test(value) {
        assert.throws(() => { snap.getPathPrefix(value); }, /badValue/);
      }

      test(null);
      test(undefined);
      test(123);
      test(new FrozenBuffer('florp'));

      // Invalid storage path strings.
      test('');
      test('florp');
      test('//zorch//splat');
      test(new FrozenBuffer('florp').hash); // Valid _id_ but invalid _path_.
    });
  });

  describe('getPathRange', () => {
    it('should retrieve all bindings in the indicated range', () => {
      const buf1 = new FrozenBuffer('buf1');
      const buf2 = new FrozenBuffer('buf2');
      const buf3 = new FrozenBuffer('buf3');
      const snap = new FileSnapshot(914, [
        FileOp.op_writePath('/a',        buf1),
        FileOp.op_writePath('/d',        buf2),
        FileOp.op_writePath('/d/r',      buf3),
        FileOp.op_writePath('/d/r/b',    buf1),
        FileOp.op_writePath('/d/r/10',   buf2),
        FileOp.op_writePath('/d/r/11',   buf3),
        FileOp.op_writePath('/d/r/12',   buf1),
        FileOp.op_writePath('/d/r/13',   buf2),
        FileOp.op_writePath('/d/r/14',   buf3),
        FileOp.op_writePath('/d/r/15',   buf1),
        FileOp.op_writePath('/d/r/16/x', buf2),
        FileOp.op_writePath('/d/r/17',   buf3),
        FileOp.op_writePath('/d/r/18',   buf1),
        FileOp.op_writePath('/d/rr',     buf2),
        FileOp.op_writeBlob(buf1)
      ]);

      const result = snap.getPathRange('/d/r', 12, 18);

      assert.instanceOf(result, Map);
      assert.sameDeepMembers([...result.entries()], Object.entries({
        '/d/r/12': buf1,
        '/d/r/13': buf2,
        '/d/r/14': buf3,
        '/d/r/15': buf1,
        '/d/r/17': buf3
      }));
    });

    it('should reject a bogus prefix', () => {
      const snap = FileSnapshot.EMPTY;

      function test(value) {
        assert.throws(() => { snap.getPathRange(value, 0, 1); }, /badValue/);
      }

      test(null);
      test(undefined);
      test(123);
      test(new FrozenBuffer('florp'));

      // Invalid storage path strings.
      test('');
      test('florp');
      test('//zorch//splat');
      test(new FrozenBuffer('florp').hash); // Valid _id_ but invalid _path_.
    });

    it('should reject a bogus range', () => {
      const snap = FileSnapshot.EMPTY;

      function test(start, end) {
        assert.throws(() => { snap.getPathRange('/x', start, end); }, /badValue/);
      }

      // Wrong type of one argument or the other (or both).
      test(null,      null);
      test(0,         null);
      test(null,      1);
      test(undefined, undefined);
      test(123,       undefined);
      test(undefined, 'x');
      test(false,     true);
      test([1],       { x: 2 });

      // Wrong numeric type.
      test(-2,  -1);
      test(-2,  1);
      test(0.1, 3.6);
      test(1,   3.45);
      test(1.2, 123);
      test(0,   Infinity);
      test(NaN, 123);

      // Empty or inverted range.
      test(0,   0);
      test(1,   0);
      test(123, 5);
    });
  });
});
