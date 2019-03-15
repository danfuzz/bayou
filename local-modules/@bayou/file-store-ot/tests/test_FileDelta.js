// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { FileDelta, FileOp } from '@bayou/file-store-ot';
import { FrozenBuffer } from '@bayou/util-common';

import { MockDelta } from '@bayou/ot-common/mocks';

describe('@bayou/file-store-ot/FileDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = FileDelta.EMPTY;

    it('is an instance of `FileDelta`', () => {
      assert.instanceOf(EMPTY, FileDelta);
    });

    it('is a frozen object', () => {
      assert.isFrozen(EMPTY);
    });

    it('has an empty `ops`', () => {
      assert.strictEqual(EMPTY.ops.length, 0);
    });

    it('has a frozen `ops`', () => {
      assert.isFrozen(EMPTY.ops);
    });

    it('elicits `true` from `.isEmpty()`', () => {
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
        it(`succeeds for: ${inspect(v)}`, () => {
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
        it(`fails for: ${inspect(v)}`, () => {
          assert.throws(() => new FileDelta(v));
        });
      }
    });
  });

  describe('compose()', () => {
    // Common test cases for both document and non-document results.
    function commonCases(wantDocument) {
      it('returns an empty result from `EMPTY.compose(EMPTY)`', () => {
        const result = FileDelta.EMPTY.compose(FileDelta.EMPTY, wantDocument);
        assert.instanceOf(result, FileDelta);
        assert.deepEqual(result.ops, []);
      });

      it('rejects calls when `other` is not an instance of the class', () => {
        const delta = FileDelta.EMPTY;

        assert.throws(() => delta.compose('blort', wantDocument));
        assert.throws(() => delta.compose(null, wantDocument));
        assert.throws(() => delta.compose(new MockDelta([]), wantDocument));
      });

      it('results in no more than one op per storage ID, with `other` taking precedence', () => {
        function test(ops1, ops2, expectOps) {
          const d1     = new FileDelta(ops1);
          const d2     = new FileDelta(ops2);
          const result = d1.compose(d2, wantDocument);

          assert.sameMembers(result.ops, expectOps);
        }

        const op_a1 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'));
        const op_a2 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ccc'));
        const op_a3 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ddd'));
        const op_b1 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ccc'));
        const op_b2 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ddd'));

        test([op_a1],        [],             [op_a1]);
        test([],             [op_a1],        [op_a1]);
        test([op_a1],        [op_a2],        [op_a2]);
        test([],             [op_a1, op_a2], [op_a2]);
        test([op_a3],        [op_a1, op_a2], [op_a2]);
        test([op_a1],        [op_b1],        [op_a1, op_b1]);
        test([op_a1, op_b1], [op_b2],        [op_a1, op_b2]);
        test([op_a1, op_b1], [op_b2, op_a2], [op_a2, op_b2]);
      });
    }

    describe('wantDocument === `false`', () => {
      commonCases(false);

      it('handles `deleteAll` ops', () => {
        const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
        const op2    = FileOp.op_writeBlob(FrozenBuffer.coerce('222'));
        const op3    = FileOp.op_deleteAll();
        const op4    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
        const d1     = new FileDelta([op1]);
        const d2     = new FileDelta([op2, op3, op4]);
        const result = d1.compose(d2, false);

        // Order of operations matters!
        assert.deepEqual(result.ops, [op3, op4]);
      });

      it('handles `deleteBlob` ops', () => {
        const blob1  = new FrozenBuffer('a1');
        const blob2  = new FrozenBuffer('b2');
        const blob3  = new FrozenBuffer('c3');
        const blob4  = new FrozenBuffer('d4');
        const op1    = FileOp.op_writePath('/aaa', new FrozenBuffer('111'));
        const op2    = FileOp.op_writeBlob(blob1);
        const op3    = FileOp.op_writeBlob(blob2);
        const op4    = FileOp.op_deleteBlob(blob1);
        const op5    = FileOp.op_deleteBlob(blob2);
        const op6    = FileOp.op_deleteBlob(blob3);
        const op7    = FileOp.op_writeBlob(blob4);
        const d1     = new FileDelta([op1, op2, op3, op4]);
        const d2     = new FileDelta([op5, op6, op7, op3]);
        const result = d1.compose(d2, false);

        assert.sameMembers(result.ops, [op1, op3, op4, op6, op7]);
      });

      it('handles `deletePath` ops', () => {
        function test(ops1, ops2, expectOps) {
          const d1     = new FileDelta(ops1);
          const d2     = new FileDelta(ops2);
          const result = d1.compose(d2, false);

          assert.sameMembers(result.ops, expectOps);
        }

        const op_a1   = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'));
        const op_a2   = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ddd'));
        const op_b1   = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ccc'));
        const op_adel = FileOp.op_deletePath('/aaa');

        test([op_a1, op_adel], [],               [op_adel]);
        test([op_adel],        [],               [op_adel]);
        test([],               [op_a1, op_adel], [op_adel]);
        test([],               [op_adel],        [op_adel]);
        test([op_a2],          [op_a1, op_adel], [op_adel]);
        test([op_a2],          [op_adel],        [op_adel]);
        test([op_a1, op_b1],   [op_adel],        [op_adel, op_b1]);
      });

      it('handles `deletePathPrefix` ops', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('111'));
        const op3    = FileOp.op_writePath('/a/b/y',   FrozenBuffer.coerce('222'));
        const op4    = FileOp.op_writePath('/a/b/z',   FrozenBuffer.coerce('333'));
        const op5    = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op6    = FileOp.op_deletePathPrefix('/a/b');
        const op7    = FileOp.op_deletePathPrefix('/zomg');
        const d1     = new FileDelta([op1, op2, op3, op4, op5]);
        const d2     = new FileDelta([op6, op7, op2]);
        const result = d1.compose(d2, false);

        assert.sameMembers(result.ops, [op6, op7, op2, op5]);

        // The delete ops should be first (because otherwise one of them would
        // improperly moot one of the writes).
        assert.sameMembers(result.ops.slice(0, 2), [op6, op7]);
      });

      it('handles `deletePathRange` ops', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('x'));
        const op3    = FileOp.op_writePath('/a/b/3/x', FrozenBuffer.coerce('x'));
        const op4    = FileOp.op_writePath('/a/b/1',   FrozenBuffer.coerce('111'));
        const op5    = FileOp.op_writePath('/a/b/2',   FrozenBuffer.coerce('222'));
        const op6    = FileOp.op_writePath('/a/b/3',   FrozenBuffer.coerce('333'));
        const op7    = FileOp.op_writePath('/a/b/4',   FrozenBuffer.coerce('111'));
        const op8    = FileOp.op_writePath('/a/b/15',  FrozenBuffer.coerce('222'));
        const op9    = FileOp.op_writePath('/a/b/16',  FrozenBuffer.coerce('333'));
        const op10   = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op11   = FileOp.op_deletePathRange('/a/b', 2, 16);
        const op12   = FileOp.op_deletePathRange('/zomg', 10, 20);
        const d1     = new FileDelta([op1, op2, op3, op4, op5, op6, op7, op8, op9, op10]);
        const d2     = new FileDelta([op11, op12, op6]);
        const result = d1.compose(d2, false);

        assert.sameMembers(result.ops, [op11, op12, op1, op2, op3, op4, op6, op9, op10]);

        // The delete ops should be first (because otherwise one of them would
        // improperly moot one of the writes).
        assert.sameMembers(result.ops.slice(0, 2), [op11, op12]);
      });
    });

    describe('wantDocument === `true`', () => {
      commonCases(true);

      it('rejects a non-document `this`', () => {
        function test(...ops) {
          const delta = new FileDelta(ops);
          assert.throws(() => delta.compose(FileDelta.EMPTY, true), /badUse/);
        }

        test(FileOp.op_deleteAll());
        test(FileOp.op_deleteBlob(new FrozenBuffer('123')));
        test(FileOp.op_deletePath('/aaa'));
        test(FileOp.op_deletePathPrefix('/bbb'));
        test(FileOp.op_deletePathRange('/ccc', 123, 914));

        test(
          FileOp.op_writePath('/aaa', new FrozenBuffer('123')),
          FileOp.op_deletePath('/aaa'));
      });

      it('executes `deleteAll` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
        const op2    = FileOp.op_writeBlob(FrozenBuffer.coerce('222'));
        const op3    = FileOp.op_deleteAll();
        const op4    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
        const d1     = new FileDelta([op1]);
        const d2     = new FileDelta([op2, op3, op4]);
        const result = d1.compose(d2, true);

        assert.sameMembers(result.ops, [op4]);
      });

      it('executes `deleteBlob` ops but does not include them in the result', () => {
        const blob1  = new FrozenBuffer('a');
        const blob2  = new FrozenBuffer('b');
        const blob3  = new FrozenBuffer('c');
        const blob4  = new FrozenBuffer('d');
        const op1    = FileOp.op_writePath('/aaa', new FrozenBuffer('111'));
        const op2    = FileOp.op_writeBlob(blob1);
        const op3    = FileOp.op_writeBlob(blob2);
        const op4    = FileOp.op_writeBlob(blob3);
        const op5    = FileOp.op_deleteBlob(blob2);
        const op6    = FileOp.op_deleteBlob(blob3);
        const op7    = FileOp.op_writeBlob(blob4);
        const d1     = new FileDelta([op1, op2, op3, op4]);
        const d2     = new FileDelta([op5, op6, op7, op3]);
        const result = d1.compose(d2, true);

        assert.sameMembers(result.ops, [op1, op2, op3, op7]);
      });

      it('executes `deletePath` ops but does not include them in the result', () => {
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

      it('executes `deletePathPrefix` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('111'));
        const op3    = FileOp.op_writePath('/a/b/y',   FrozenBuffer.coerce('222'));
        const op4    = FileOp.op_writePath('/a/b/z',   FrozenBuffer.coerce('333'));
        const op5    = FileOp.op_writePath('/a/a',     FrozenBuffer.coerce('x'));
        const op6    = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op7    = FileOp.op_writeBlob(FrozenBuffer.coerce('florp'));
        const op8    = FileOp.op_deletePathPrefix('/a/b');
        const op9    = FileOp.op_deletePathPrefix('/zomg');
        const d1     = new FileDelta([op1, op2, op3, op4, op5, op6, op7]);
        const d2     = new FileDelta([op8, op9, op3]);
        const result = d1.compose(d2, true);

        assert.sameMembers(result.ops, [op3, op5, op6, op7]);
      });

      it('executes `deletePathRange` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('x'));
        const op3    = FileOp.op_writePath('/a/b/3/x', FrozenBuffer.coerce('x'));
        const op4    = FileOp.op_writePath('/a/b/1',   FrozenBuffer.coerce('111'));
        const op5    = FileOp.op_writePath('/a/b/2',   FrozenBuffer.coerce('222'));
        const op6    = FileOp.op_writePath('/a/b/3',   FrozenBuffer.coerce('333'));
        const op7    = FileOp.op_writePath('/a/b/4',   FrozenBuffer.coerce('111'));
        const op8    = FileOp.op_writePath('/a/b/15',  FrozenBuffer.coerce('222'));
        const op9    = FileOp.op_writePath('/a/b/16',  FrozenBuffer.coerce('333'));
        const op10   = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op11   = FileOp.op_writeBlob(FrozenBuffer.coerce('florp'));
        const op12   = FileOp.op_deletePathRange('/a/b', 2, 16);
        const op13   = FileOp.op_deletePathRange('/zomg', 10, 20);
        const d1     = new FileDelta([op1, op2, op3, op4, op5, op6, op7, op8, op9, op10, op11]);
        const d2     = new FileDelta([op12, op13, op6]);
        const result = d1.compose(d2, true);

        assert.sameMembers(result.ops, [op1, op2, op3, op4, op6, op9, op10, op11]);
      });
    });
  });

  describe('composeAll()', () => {
    // Common test cases for both document and non-document results.
    function commonCases(wantDocument) {
      it('returns `this` when passed an empty array', () => {
        const delta = new FileDelta([FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'))]);
        assert.strictEqual(delta.composeAll([], wantDocument), delta);
      });

      it('returns an empty result when `EMPTY` is only composed with `EMPTY`s', () => {
        for (let i = 1; i < 10; i++) {
          const deltas = Array.from({ length: i }, () => FileDelta.EMPTY);
          const result = FileDelta.EMPTY.composeAll(deltas, wantDocument);
          const msg    = `length ${i}`;
          assert.instanceOf(result, FileDelta, msg);
          assert.deepEqual(result.ops, [], msg);
        }
      });

      it('rejects calls when a `deltas` element is not an instance of the class', () => {
        const delta = FileDelta.EMPTY;

        for (let i = 0; i < 5; i++) {
          const deltas = Array.from({ length: i }, () => FileDelta.EMPTY);
          const msg    = `length ${i}`;

          assert.throws(() => delta.composeAll([...deltas, 'blort'], wantDocument), /badValue/, msg);
          assert.throws(() => delta.composeAll([null, ...deltas], wantDocument), /badValue/, msg);
          assert.throws(() => delta.composeAll([...deltas, new MockDelta([]), ...deltas], wantDocument), /badValue/, msg);
        }
      });

      it('results in no more than one op per storage ID, with later ones taking precedence', () => {
        function test(opses, expectOps) {
          const [delta, ...deltas] = opses.map(ops => new FileDelta(ops));
          const result = delta.composeAll(deltas, wantDocument);

          assert.sameMembers(result.ops, expectOps);
        }

        const op_a1 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'));
        const op_a2 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ccc'));
        const op_a3 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ddd'));
        const op_b1 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ccc'));
        const op_b2 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ddd'));
        const op_c1 = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('qqq'));
        const op_c2 = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('rrr'));

        test([[op_a1], []],                    [op_a1]);
        test([[], [op_a1]],                    [op_a1]);
        test([[op_a1], [op_a2]],               [op_a2]);
        test([[], [op_a1, op_a2]],             [op_a2]);
        test([[op_a3], [op_a1, op_a2]],        [op_a2]);
        test([[op_a1], [op_b1]],               [op_a1, op_b1]);
        test([[op_a1, op_b1], [op_b2]],        [op_a1, op_b2]);
        test([[op_a1, op_b1], [op_b2, op_a2]], [op_a2, op_b2]);

        test([[op_a1], [op_a2], [op_a3]],          [op_a3]);
        test([[op_a1, op_b1], [op_a2], [op_a3]],   [op_a3, op_b1]);
        test([[op_a1], [op_a2, op_b1], [op_a3]],   [op_a3, op_b1]);
        test([[op_b1], [op_a1], [op_b2]],          [op_a1, op_b2]);
        test([[op_a1], [op_b1], [op_c1]],          [op_a1, op_b1, op_c1]);
        test([[op_a1], [op_b1, op_c1], [op_c2]],   [op_a1, op_b1, op_c2]);
        test([[op_a1], [op_b1], [op_c1], [op_a2]], [op_a2, op_b1, op_c1]);
      });
    }

    describe('wantDocument === `false`', () => {
      commonCases(false);

      it('handles `deleteAll` ops', () => {
        const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
        const op2    = FileOp.op_writeBlob(FrozenBuffer.coerce('222'));
        const op3    = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('111'));
        const op4    = FileOp.op_writeBlob(FrozenBuffer.coerce('333'));
        const op5    = FileOp.op_deleteAll();
        const op6    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
        const op7    = FileOp.op_writePath('/ddd', FrozenBuffer.coerce('444'));
        const d1     = new FileDelta([op1, op2]);
        const d2     = new FileDelta([op3, op4]);
        const d3     = new FileDelta([op5, op6]);
        const d4     = new FileDelta([op7]);
        const result = d1.composeAll([d2, d3, d4], false);

        // Order of operations matters!
        assert.deepEqual(result.ops, [op5, op6, op7]);
      });

      it('handles `deleteBlob` ops', () => {
        const blob1  = new FrozenBuffer('a1');
        const blob2  = new FrozenBuffer('b2');
        const blob3  = new FrozenBuffer('c3');
        const blob4  = new FrozenBuffer('d4');
        const op1    = FileOp.op_writePath('/aaa', new FrozenBuffer('111'));
        const op2    = FileOp.op_writeBlob(blob1);
        const op3    = FileOp.op_writeBlob(blob2);
        const op4    = FileOp.op_deleteBlob(blob1);
        const op5    = FileOp.op_deleteBlob(blob2);
        const op6    = FileOp.op_deleteBlob(blob3);
        const op7    = FileOp.op_writeBlob(blob4);
        const d1     = new FileDelta([op1, op2]);
        const d2     = new FileDelta([op3, op4]);
        const d3     = new FileDelta([op5, op6]);
        const d4     = new FileDelta([op7, op3]);
        const result = d1.composeAll([d2, d3, d4], false);

        assert.sameMembers(result.ops, [op1, op3, op4, op6, op7]);
      });

      it('handles `deletePath` ops', () => {
        function test(opses, expectOps) {
          const [delta, ...deltas] = opses.map(ops => new FileDelta(ops));
          const result = delta.composeAll(deltas, false);

          assert.sameMembers(result.ops, expectOps);
        }

        const op_a1   = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('bbb'));
        const op_a2   = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('ddd'));
        const op_b1   = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('ccc'));
        const op_adel = FileOp.op_deletePath('/aaa');

        test([[op_a1, op_adel], []],      [op_adel]);
        test([[op_adel], []],             [op_adel]);
        test([[], [op_a1, op_adel]],      [op_adel]);
        test([[], [op_adel]],             [op_adel]);
        test([[op_a2], [op_a1, op_adel]], [op_adel]);
        test([[op_a2], [op_adel]],        [op_adel]);
        test([[op_a1, op_b1], [op_adel]], [op_adel, op_b1]);

        test([[op_a1], [], [op_adel]],             [op_adel]);
        test([[op_a1], [op_b1], [op_adel]],        [op_adel, op_b1]);
        test([[op_a1], [op_a2], [op_adel, op_b1]], [op_adel, op_b1]);
      });

      it('handles `deletePathPrefix` ops', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('111'));
        const op3    = FileOp.op_writePath('/a/b/y',   FrozenBuffer.coerce('222'));
        const op4    = FileOp.op_writePath('/a/b/z',   FrozenBuffer.coerce('333'));
        const op5    = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op6    = FileOp.op_deletePathPrefix('/a/b');
        const op7    = FileOp.op_deletePathPrefix('/zomg');
        const d1     = new FileDelta([op1, op2, op3, op4, op5]);
        const d2     = new FileDelta([op3, op4, op5]);
        const d3     = new FileDelta([op6]);
        const d4     = new FileDelta([op7, op2]);
        const result = d1.composeAll([d2, d3, d4], false);

        assert.sameMembers(result.ops, [op6, op7, op2, op5]);

        // The delete ops should be first (because otherwise one of them would
        // improperly moot one of the writes).
        assert.sameMembers(result.ops.slice(0, 2), [op6, op7]);
      });

      it('handles `deletePathRange` ops', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('x'));
        const op3    = FileOp.op_writePath('/a/b/3/x', FrozenBuffer.coerce('x'));
        const op4    = FileOp.op_writePath('/a/b/1',   FrozenBuffer.coerce('111'));
        const op5    = FileOp.op_writePath('/a/b/2',   FrozenBuffer.coerce('222'));
        const op6    = FileOp.op_writePath('/a/b/3',   FrozenBuffer.coerce('333'));
        const op7    = FileOp.op_writePath('/a/b/4',   FrozenBuffer.coerce('111'));
        const op8    = FileOp.op_writePath('/a/b/15',  FrozenBuffer.coerce('222'));
        const op9    = FileOp.op_writePath('/a/b/16',  FrozenBuffer.coerce('333'));
        const op10   = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op11   = FileOp.op_deletePathRange('/a/b', 2, 16);
        const op12   = FileOp.op_deletePathRange('/zomg', 10, 20);
        const d1     = new FileDelta([op1, op2, op3, op4, op5]);
        const d2     = new FileDelta([op6, op7, op8, op9, op10]);
        const d3     = new FileDelta([op11]);
        const d4     = new FileDelta([op12, op6]);
        const result = d1.composeAll([d2, d3, d4], false);

        assert.sameMembers(result.ops, [op11, op12, op1, op2, op3, op4, op6, op9, op10]);

        // The delete ops should be first (because otherwise one of them would
        // improperly moot one of the writes).
        assert.sameMembers(result.ops.slice(0, 2), [op11, op12]);
      });
    });

    describe('wantDocument === `true`', () => {
      commonCases(true);

      it('rejects a non-document `this`', () => {
        function test(...ops) {
          const delta = new FileDelta(ops);
          assert.throws(() => delta.composeAll([], true), /badUse/);
          assert.throws(() => delta.composeAll([FileDelta.EMPTY], true), /badUse/);
        }

        test(FileOp.op_deleteAll());
        test(FileOp.op_deleteBlob(new FrozenBuffer('123')));
        test(FileOp.op_deletePath('/aaa'));
        test(FileOp.op_deletePathPrefix('/bbb'));
        test(FileOp.op_deletePathRange('/ccc', 123, 914));

        test(
          FileOp.op_writePath('/aaa', new FrozenBuffer('123')),
          FileOp.op_deletePath('/aaa'));
      });

      it('executes `deleteAll` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
        const op2    = FileOp.op_writeBlob(FrozenBuffer.coerce('222'));
        const op3    = FileOp.op_deleteAll();
        const op4    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
        const d1     = new FileDelta([op1]);
        const d2     = new FileDelta([op2]);
        const d3     = new FileDelta([op3, op4]);
        const result = d1.composeAll([d2, d3], true);

        assert.sameMembers(result.ops, [op4]);
      });

      it('executes `deleteBlob` ops but does not include them in the result', () => {
        const blob1  = new FrozenBuffer('a');
        const blob2  = new FrozenBuffer('b');
        const blob3  = new FrozenBuffer('c');
        const blob4  = new FrozenBuffer('d');
        const op1    = FileOp.op_writePath('/aaa', new FrozenBuffer('111'));
        const op2    = FileOp.op_writeBlob(blob1);
        const op3    = FileOp.op_writeBlob(blob2);
        const op4    = FileOp.op_writeBlob(blob3);
        const op5    = FileOp.op_deleteBlob(blob2);
        const op6    = FileOp.op_deleteBlob(blob3);
        const op7    = FileOp.op_writeBlob(blob4);
        const d1     = new FileDelta([op1, op2]);
        const d2     = new FileDelta([op3, op4]);
        const d3     = new FileDelta([op5, op6]);
        const d4     = new FileDelta([op7, op3]);
        const result = d1.composeAll([d2, d3, d4], true);

        assert.sameMembers(result.ops, [op1, op2, op3, op7]);
      });

      it('executes `deletePath` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
        const op2    = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('222'));
        const op3    = FileOp.op_writePath('/ccc', FrozenBuffer.coerce('333'));
        const op4    = FileOp.op_deletePath('/bbb');
        const op5    = FileOp.op_deletePath('/ddd');
        const d1     = new FileDelta([op1, op2]);
        const d2     = new FileDelta([op3]);
        const d3     = new FileDelta([op4, op5]);
        const result = d1.composeAll([d2, d3], true);

        assert.sameMembers(result.ops, [op1, op3]);
      });

      it('executes `deletePathPrefix` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('111'));
        const op3    = FileOp.op_writePath('/a/b/y',   FrozenBuffer.coerce('222'));
        const op4    = FileOp.op_writePath('/a/b/z',   FrozenBuffer.coerce('333'));
        const op5    = FileOp.op_writePath('/a/a',     FrozenBuffer.coerce('x'));
        const op6    = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op7    = FileOp.op_writeBlob(FrozenBuffer.coerce('florp'));
        const op8    = FileOp.op_deletePathPrefix('/a/b');
        const op9    = FileOp.op_deletePathPrefix('/zomg');
        const d1     = new FileDelta([op1, op2, op3, op4]);
        const d2     = new FileDelta([op5, op6, op7]);
        const d3     = new FileDelta([op8]);
        const d4     = new FileDelta([op9, op3]);
        const result = d1.composeAll([d2, d3, d4], true);

        assert.sameMembers(result.ops, [op3, op5, op6, op7]);
      });

      it('executes `deletePathRange` ops but does not include them in the result', () => {
        const op1    = FileOp.op_writePath('/a/b',     FrozenBuffer.coerce('000'));
        const op2    = FileOp.op_writePath('/a/b/x',   FrozenBuffer.coerce('x'));
        const op3    = FileOp.op_writePath('/a/b/3/x', FrozenBuffer.coerce('x'));
        const op4    = FileOp.op_writePath('/a/b/1',   FrozenBuffer.coerce('111'));
        const op5    = FileOp.op_writePath('/a/b/2',   FrozenBuffer.coerce('222'));
        const op6    = FileOp.op_writePath('/a/b/3',   FrozenBuffer.coerce('333'));
        const op7    = FileOp.op_writePath('/a/b/4',   FrozenBuffer.coerce('111'));
        const op8    = FileOp.op_writePath('/a/b/15',  FrozenBuffer.coerce('222'));
        const op9    = FileOp.op_writePath('/a/b/16',  FrozenBuffer.coerce('333'));
        const op10   = FileOp.op_writePath('/a/zorch', FrozenBuffer.coerce('x'));
        const op11   = FileOp.op_writeBlob(FrozenBuffer.coerce('florp'));
        const op12   = FileOp.op_deletePathRange('/a/b', 2, 16);
        const op13   = FileOp.op_deletePathRange('/zomg', 10, 20);
        const d1     = new FileDelta([op1, op2, op3, op4]);
        const d2     = new FileDelta([op5, op6, op7, op8]);
        const d3     = new FileDelta([op9, op10, op11]);
        const d4     = new FileDelta([op12]);
        const d5     = new FileDelta([op13]);
        const d6     = new FileDelta([op6]);
        const result = d1.composeAll([d2, d3, d4, d5, d6], true);

        assert.sameMembers(result.ops, [op1, op2, op3, op4, op6, op9, op10, op11]);
      });
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
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

    it('returns `true` when passed an identically-constructed value', () => {
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

    it('returns `true` when equal ops are not also `===`', () => {
      const buf = FrozenBuffer.coerce('splortch');
      const ops1 = [FileOp.op_writePath('/aaa', buf)];
      const ops2 = [FileOp.op_writePath('/aaa', buf)];
      const d1 = new FileDelta(ops1);
      const d2 = new FileDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('returns `false` when array lengths differ', () => {
      const op1 = FileOp.op_writePath('/aaa', FrozenBuffer.coerce('111'));
      const op2 = FileOp.op_writePath('/bbb', FrozenBuffer.coerce('222'));
      const d1  = new FileDelta([op1]);
      const d2  = new FileDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('returns `false` when corresponding ops differ', () => {
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

    it('returns `false` when passed a non-instance or an instance of a different class', () => {
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
        it(`returns \`true\` for: ${inspect(v)}`, () => {
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
        [FileOp.op_deletePathPrefix('/xyz')],
        [FileOp.op_deletePathRange('/xyz', 1, 10)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf1)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf2)],
        [FileOp.op_writeBlob(buf1), FileOp.op_writeBlob(buf1)],
      ];

      for (const v of values) {
        it(`returns \`false\` for: ${inspect(v)}`, () => {
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
        it(`returns \`true\` for: ${inspect(v)}`, () => {
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
        [FileOp.op_deletePathPrefix('/xyz')],
        [FileOp.op_deletePathRange('/xyz', 1, 10)],
        [FileOp.op_writePath('/aaa', buf1)],
        [FileOp.op_writePath('/aaa', buf1), FileOp.op_writePath('/aaa', buf2)],
        [FileOp.op_writeBlob(buf1)],
        [FileOp.op_writeBlob(buf1), FileOp.op_writeBlob(buf2)]
      ];

      for (const v of values) {
        it(`returns \`false\` for: ${inspect(v)}`, () => {
          const delta = new FileDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
