// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import Delta from 'quill-delta';
import { inspect } from 'util';

import { BodyDelta, BodyOp } from 'doc-common';

/**
 * Helper to call `new BodyDelta()` with a deep-frozen argument.
 *
 * @param {*} ops Value to pass to the constructor, which doesn't have to be
 *   frozen.
 * @returns {BodyDelta} the result of calling the constructor with a deep-frozen
 *   version of `ops`.
 */
function newWithFrozenOps(ops) {
  return new BodyDelta(ops);
}

describe('doc-common/BodyDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = BodyDelta.EMPTY;

    it('should be an instance of `BodyDelta`', () => {
      assert.instanceOf(EMPTY, BodyDelta);
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

  describe('fromQuillForm()', () => {
    it('should return an instance with equal `ops`', () => {
      const ops        = [{ insert: 'foo' }, { retain: 10 }, { insert: 'bar' }];
      const quillDelta = new Delta(ops);
      const result     = BodyDelta.fromQuillForm(quillDelta);

      assert.deepEqual(result.ops, ops);
    });

    it('should reject non-quill-delta arguments', () => {
      function test(v) {
        assert.throws(() => { BodyDelta.fromQuillForm(v); });
      }

      test(null);
      test(undefined);
      test(false);
      test('blort');
      test(BodyOp.op_insertText('123'));
      test([BodyOp.op_insertText('123')]);
      test(BodyDelta.EMPTY);
    });
  });

  describe('constructor()', () => {
    describe('valid arguments', () => {
      const values = [
        [],
        [BodyOp.op_insertText('x')],
        [BodyOp.op_insertText('x', { bold: true })],
        [BodyOp.op_delete(123)],
        [BodyOp.op_retain(123)],
        [BodyOp.op_retain(123, { bold: true })],
        [BodyOp.op_insertText('x'), BodyOp.op_insertText('y', { bold: true })]
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          newWithFrozenOps(v);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
        null,
        undefined,
        123,
        'florp',
        { insert: 'x' },
        [{ insert: 'x' }],
        new Map(),
        [null],
        [undefined],
        ['x'],
        [1, 2, 3]
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => new BodyDelta(v));
          assert.throws(() => newWithFrozenOps(v));
        });
      }
    });
  });

  describe('compose()', () => {
    it('should return an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result = BodyDelta.EMPTY.compose(BodyDelta.EMPTY);
      assert.instanceOf(result, BodyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.compose(other));
    });
  });

  describe('diff()', () => {
    it('should return an empty result from `EMPTY.diff(EMPTY)`', () => {
      const result = BodyDelta.EMPTY.diff(BodyDelta.EMPTY);
      assert.instanceOf(result, BodyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('should reject calls when `this` is not a document', () => {
      const delta = newWithFrozenOps([BodyOp.op_retain(10)]);
      const other = BodyDelta.EMPTY;
      assert.throws(() => delta.diff(other));
    });

    it('should reject calls when `other` is not a document', () => {
      const delta = BodyDelta.EMPTY;
      const other = new newWithFrozenOps([BodyOp.op_retain(10)]);
      assert.throws(() => delta.diff(other));
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.diff(other));
    });
  });

  describe('compose() / diff()', () => {
    // These tests take composition triples `origDoc + change = newDoc` and test
    // `compose()` and `diff()` in various combinations.
    function test(label, origDoc, change, newDoc) {
      origDoc = newWithFrozenOps(origDoc);
      change  = newWithFrozenOps(change);
      newDoc  = newWithFrozenOps(newDoc);

      describe(label, () => {
        it('should produce the expected composition', () => {
          const result = origDoc.compose(change);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });

        it('should produce the expected diff', () => {
          const result = origDoc.diff(newDoc);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, change.ops);
        });

        it('should produce the new doc when composing the orig doc with the diff', () => {
          const diff   = origDoc.diff(newDoc);
          const result = origDoc.compose(diff);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });
      });
    }

    test('full replacement',
      [BodyOp.op_insertText('111')],
      [BodyOp.op_insertText('222'), BodyOp.op_delete(3)],
      [BodyOp.op_insertText('222')]);
    test('insert at start',
      [BodyOp.op_insertText('111')],
      [BodyOp.op_insertText('222')],
      [BodyOp.op_insertText('222111')]);
    test('append at end',
      [BodyOp.op_insertText('111')],
      [BodyOp.op_retain(3), BodyOp.op_insertText('222')],
      [BodyOp.op_insertText('111222')]);
    test('surround',
      [BodyOp.op_insertText('111')],
      [BodyOp.op_insertText('222'), BodyOp.op_retain(3), BodyOp.op_insertText('333')],
      [BodyOp.op_insertText('222111333')]);
    test('replace one middle bit',
      [BodyOp.op_insertText('Drink more Slurm.')],
      [BodyOp.op_retain(6), BodyOp.op_insertText('LESS'), BodyOp.op_delete(4)],
      [BodyOp.op_insertText('Drink LESS Slurm.')]);
    test('replace two middle bits',
      [BodyOp.op_insertText('[[hello]] [[goodbye]]')],
      [
        BodyOp.op_retain(2), BodyOp.op_insertText('YO'), BodyOp.op_delete(5), BodyOp.op_retain(5),
        BodyOp.op_insertText('LATER'), BodyOp.op_delete(7)
      ],
      [BodyOp.op_insertText('[[YO]] [[LATER]]')]);
  });

  describe('isDocument()', () => {
    describe('`true` cases', () => {
      const values = [
        [],
        [BodyOp.op_insertText('line 1')],
        [BodyOp.op_insertText('line 1'), BodyOp.op_insertText('\n')],
        [BodyOp.op_insertText('line 1'), BodyOp.op_insertText('\n'), BodyOp.op_insertText('line 2')]
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(newWithFrozenOps(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const values = [
        [BodyOp.op_retain(37)],
        [BodyOp.op_delete(914)],
        [BodyOp.op_retain(37, { bold: true })],
        [BodyOp.op_insertText('line 1'), BodyOp.op_retain(9)],
        [BodyOp.op_insertText('line 1'), BodyOp.op_retain(14), BodyOp.op_insertText('\n')],
        [BodyOp.op_insertText('line 1'), BodyOp.op_insertText('\n'), BodyOp.op_retain(23), BodyOp.op_insertText('line 2')]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(newWithFrozenOps(v).isDocument());
        });
      }
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        newWithFrozenOps([]),
        BodyDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        [BodyOp.op_insertText('x')],
        [BodyOp.op_insertText('line 1'), BodyOp.op_insertText('\n'), BodyOp.op_insertText('line 2')],
        [BodyOp.op_retain(100)]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = newWithFrozenOps(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });

  describe('toQuillForm()', () => {
    it('should produce `Delta` instances with appropriately-converted ops', () => {
      function test(ops) {
        const delta  = newWithFrozenOps(ops);
        const result = delta.toQuillForm();
        assert.instanceOf(result, Delta);
        assert.strictEqual(result.ops, delta.ops);
      }

      test([]);
      test([BodyOp.op_insertText('blort')]);
      test([BodyOp.op_retain(123)]);
    });
  });

  describe('transform()', () => {
    it('should return an empty result from `EMPTY.transform(EMPTY, *)`', () => {
      const result1 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, false);
      assert.instanceOf(result1, BodyDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, true);
      assert.instanceOf(result2, BodyDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('should reject calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.transform(other, true));
    });

    it('should reject calls when `thisIsFirst` is not a boolean', () => {
      const delta = BodyDelta.EMPTY;
      assert.throws(() => delta.transform(delta, 'blort'));
    });

    it('should produce the expected transformations', () => {
      function test(d1, d2, expectedTrue, expectedFalse = expectedTrue) {
        d1 = newWithFrozenOps(d1);
        d2 = newWithFrozenOps(d2);

        const xformTrue  = d1.transform(d2, true);
        const xformFalse = d1.transform(d2, false);

        assert.deepEqual(xformTrue.ops,  expectedTrue);
        assert.deepEqual(xformFalse.ops, expectedFalse);
      }

      test(
        [BodyOp.op_insertText('blort')],
        [BodyOp.op_insertText('blort')],
        [BodyOp.op_retain(5), BodyOp.op_insertText('blort')],
        [BodyOp.op_insertText('blort')]);
      test(
        [BodyOp.op_delete(10)],
        [BodyOp.op_delete(10)],
        []);
      test(
        [BodyOp.op_delete(10)],
        [BodyOp.op_delete(10), BodyOp.op_insertText('florp')],
        [BodyOp.op_insertText('florp')]);
      test(
        [BodyOp.op_insertText('111')],
        [BodyOp.op_insertText('222')],
        [BodyOp.op_retain(3), BodyOp.op_insertText('222')],
        [BodyOp.op_insertText('222')]);
      test(
        [BodyOp.op_retain(10), BodyOp.op_insertText('111')],
        [BodyOp.op_retain(20), BodyOp.op_insertText('222')],
        [BodyOp.op_retain(23), BodyOp.op_insertText('222')]);
    });
  });
});
