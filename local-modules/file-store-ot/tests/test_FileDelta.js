// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { FileDelta, FileOp } from 'file-store-ot';
import { FrozenBuffer } from 'util-common';

import { MockDelta } from 'ot-common/mocks';

describe('file-store-ot/FileDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = FileDelta.EMPTY;

    it('should be an instance of `FileDelta`', () => {
      assert.instanceOf(EMPTY, FileDelta);
    });

    it('should be a frozen object', () => {
      assert.isFrozen(EMPTY);
    });

    it('should have an empty `ops`', () => {
      assert.strictEqual(EMPTY.ops.length, 0);
    });

    it('should have a frozen `ops`', () => {
      assert.isFrozen(EMPTY.ops);
    });

    it('should be `.isEmpty()`', () => {
      assert.isTrue(EMPTY.isEmpty());
    });
  });

  describe('constructor()', () => {
    describe('valid arguments', () => {
      const values = [
        [],
        [FileOp.op_deleteAll()],
        [FileOp.op_deleteBlob(FrozenBuffer.coerce('blort').hash)],
        [FileOp.op_deletePath('/x/y/z')],
        [FileOp.op_deletePathPrefix('/blort/splatch')],
        [FileOp.op_deletePathRange('/florp/items', 37, 123)],
        [FileOp.op_writeBlob(FrozenBuffer.coerce('florp'))],
        [FileOp.op_writePath('/zorch', FrozenBuffer.coerce('splat'))],
        [['deleteAll']],
        [['deleteAll'], ['deleteAll'], ['deleteAll']],
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          new FileDelta(v);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
        null,
        undefined,
        false,
        123,
        'florp',
        { insert: 'x' },
        new Map(),
        [null],
        [true],
        ['x'],
        [1, 2, 3],
        [['not.a.valid.identifier', 1, 2, 3]]
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => new FileDelta(v));
        });
      }
    });
  });

  describe('compose()', () => {
    it('should return an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result1 = FileDelta.EMPTY.compose(FileDelta.EMPTY, false);
      assert.instanceOf(result1, FileDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = FileDelta.EMPTY.compose(FileDelta.EMPTY, true);
      assert.instanceOf(result2, FileDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = FileDelta.EMPTY;

      assert.throws(() => delta.compose('blort', false));
      assert.throws(() => delta.compose(null, false));
      assert.throws(() => delta.compose(new MockDelta([]), false));
    });

    it('should result in no more than one op per storage ID, with `other` taking precedence', () => {
      function test(ops1, ops2, expectOps) {
        const d1     = new FileDelta(ops1);
        const d2     = new FileDelta(ops2);
        const result = d1.compose(d2, false);

        assert.strictEqual(result.ops.length, expectOps.length);

        const opSet = new Set();
        for (const op of result.ops) {
          opSet.add(op);
        }
        for (const op of expectOps) {
          assert.isTrue(opSet.has(op), inspect(op));
          opSet.delete(op);
        }
      }

      const op1 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'));
      const op2 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ccc'));
      const op3 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ddd'));
      const op4 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('eee'));
      const op5 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ccc'));
      const op6 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ddd'));
      const op7 = FileOp.op_deletePath('/aaa');

      test([op1],      [],         [op1]);
      test([op1, op2], [],         [op2]);
      test([op1, op7], [],         [op7]);
      test([op7],      [],         [op7]);
      test([],         [op1],      [op1]);
      test([],         [op1, op2], [op2]);
      test([],         [op1, op7], [op7]);
      test([],         [op7],      [op7]);
      test([op3],      [op1],      [op1]);
      test([op3],      [op1, op2], [op2]);
      test([op3],      [op1, op7], [op7]);
      test([op3],      [op7],      [op7]);
      test([op1, op2], [op3, op4], [op4]);
      test([op1],      [op5],      [op1, op5]);
      test([op1, op5], [op6],      [op1, op6]);
      test([op1, op5], [op7],      [op5, op7]);
    });

    it('should not include deletions when `wantDocument` is `true`', () => {
      const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
      const op2    = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('222'));
      const op3    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
      const op4    = FileOp.op_deletePath('/bbb');
      const op5    = FileOp.op_deletePath('/ddd');
      const d1     = new FileDelta([op1, op2]);
      const d2     = new FileDelta([op3, op4, op5]);
      const result = d1.compose(d2, true);

      assert.sameMembers(result.ops, [op1, op3]);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      function test(ops) {
        const delta = new FileDelta(ops);
        assert.isTrue(delta.equals(delta));
      }

      const buf = FrozenBuffer.coerce('blortch');

      test([]);
      test([FileOp.op_deleteAll()]);
      test([FileOp.op_deleteBlob(buf.hash)]);
      test([FileOp.op_writeBlob(buf)]);
      test([FileOp.op_writePath('/aaa', buf)]);
      test([FileOp.op_writePath('/aaa', buf), FileOp.op_deletePath('/ccc')]);
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(ops) {
        const d1 = new FileDelta(ops);
        const d2 = new FileDelta(ops);
        assert.isTrue(d1.equals(d2));
        assert.isTrue(d2.equals(d1));
      }

      const buf = FrozenBuffer.coerce('blortch');

      test([]);
      test([FileOp.op_deleteAll()]);
      test([FileOp.op_deleteBlob(buf.hash)]);
      test([FileOp.op_writeBlob(buf)]);
      test([FileOp.op_writePath('/aaa', buf)]);
      test([FileOp.op_writePath('/aaa', buf), FileOp.op_deletePath('/ccc')]);
    });

    it('should return `true` when equal ops are not also `===`', () => {
      const buf = FrozenBuffer.coerce('splortch');
      const ops1 = [FileOp.op_writePath('/aaa', buf)];
      const ops2 = [FileOp.op_writePath('/aaa', buf)];
      const d1 = new FileDelta(ops1);
      const d2 = new FileDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('should return `false` when array lengths differ', () => {
      const op1 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
      const op2 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('222'));
      const d1  = new FileDelta([op1]);
      const d2  = new FileDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('should return `false` when corresponding ops differ', () => {
      function test(ops1, ops2) {
        const d1 = new FileDelta(ops1);
        const d2 = new FileDelta(ops2);

        assert.isFalse(d1.equals(d2));
        assert.isFalse(d2.equals(d1));
      }

      const op1 = FileOp.op_writeBlob(FrozenBuffer.coerce('aaa'));
      const op2 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ccc'));
      const op3 = FileOp.op_deleteAll();
      const op4 = FileOp.op_deletePath('/ddd');
      const op5 = FileOp.op_deleteBlob(FrozenBuffer.coerce('zorch').hash);

      test([op1],                     [op2]);
      test([op1, op2],                [op1, op3]);
      test([op1, op2],                [op3, op2]);
      test([op1, op2, op3, op4, op5], [op5, op2, op3, op4, op5]);
      test([op1, op2, op3, op4, op5], [op1, op5, op3, op4, op5]);
      test([op1, op2, op3, op4, op5], [op1, op2, op5, op4, op5]);
      test([op1, op2, op3, op4, op5], [op1, op2, op3, op5, op5]);
      test([op1, op2, op3, op4, op5], [op1, op2, op3, op4, op1]);
    });

    it('should return `false` when passed a non-instance or an instance of a different class', () => {
      const delta = new FileDelta([]);

      assert.isFalse(delta.equals(undefined));
      assert.isFalse(delta.equals(null));
      assert.isFalse(delta.equals(false));
      assert.isFalse(delta.equals(true));
      assert.isFalse(delta.equals(914));
      assert.isFalse(delta.equals(['not', 'a', 'delta']));
      assert.isFalse(delta.equals(new Map()));
      assert.isFalse(delta.equals(new MockDelta([])));
    });
  });

  describe('isDocument()', () => {
    describe('`true` cases', () => {
      const buf1 = FrozenBuffer.coerce('whooo');
      const buf2 = FrozenBuffer.coerce('yeahhh');
      const values = [
        [],
        [FileOp.op_writeBlob(buf1)],
        [FileOp.op_writeBlob(buf1), FileOp.op_writeBlob(buf2)],
        [FileOp.op_writePath('/aaa', buf1)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/ccc', buf2)],
        [
          FileOp.op_writePath('/aaa', buf1),
          FileOp.op_writePath('/ccc', buf2),
          FileOp.op_writePath('/eee', buf2)
        ],
        [
          FileOp.op_writeBlob(buf1),
          FileOp.op_writeBlob(buf2),
          FileOp.op_writePath('/aaa', buf1),
          FileOp.op_writePath('/ccc', buf2),
          FileOp.op_writePath('/eee', buf2)
        ],
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new FileDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const buf1 = FrozenBuffer.coerce('whooo');
      const buf2 = FrozenBuffer.coerce('yeahhh');
      const values = [
        [FileOp.op_deleteAll()],
        [FileOp.op_deleteBlob(buf1.hash)],
        [FileOp.op_deletePath('/xyz')],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf1)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf2)],
        [FileOp.op_writeBlob(buf1), FileOp.op_writeBlob(buf1)],
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(new FileDelta(v).isDocument());
        });
      }
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new FileDelta([]),
        FileDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const buf1 = FrozenBuffer.coerce('whooo');
      const buf2 = FrozenBuffer.coerce('yeahhh');
      const values = [
        [FileOp.op_deleteAll()],
        [FileOp.op_deleteBlob(buf1.hash)],
        [FileOp.op_deletePath('/xyz')],
        [FileOp.op_writePath('/aaa', buf1)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf2)],
        [FileOp.op_writeBlob(buf1)],
        [FileOp.op_writeBlob(buf1), FileOp.op_writeBlob(buf2)]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = new FileDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
