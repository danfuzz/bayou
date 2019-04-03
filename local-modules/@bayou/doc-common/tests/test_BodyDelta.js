// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Text } from '@bayou/config-common';
import { BodyDelta, BodyOp } from '@bayou/doc-common';

import { MockDelta } from '@bayou/ot-common/mocks';

describe('@bayou/doc-common/BodyDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = BodyDelta.EMPTY;

    it('is an instance of `BodyDelta`', () => {
      assert.instanceOf(EMPTY, BodyDelta);
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

    it('returns `true` for `.isEmpty()`', () => {
      assert.isTrue(EMPTY.isEmpty());
    });
  });

  describe('fromQuillForm()', () => {
    it('returns an instance with appropriately-converted `ops`', () => {
      const ops        = [{ insert: 'foo' }, { retain: 10 }, { insert: 'bar', attributes: { bold: true } }];
      const quillDelta = new Text.Delta(ops);
      const result     = BodyDelta.fromQuillForm(quillDelta);

      assert.deepEqual(result.ops, [
        BodyOp.op_text('foo'),
        BodyOp.op_retain(10),
        BodyOp.op_text('bar', { bold: true })
      ]);
    });

    it('rejects non-quill-delta arguments', () => {
      function test(v) {
        assert.throws(() => { BodyDelta.fromQuillForm(v); });
      }

      test(null);
      test(undefined);
      test(false);
      test('blort');
      test(BodyOp.op_text('123'));
      test([BodyOp.op_text('123')]);
      test(BodyDelta.EMPTY);
    });

    it('rejects arguments that are instances of the wrong `Delta` class', () => {
      // This test confirms that the code properly detects when there's more
      // than one class named `Delta` in the system and the one _not_ used by
      // this module is passed in here. Historically speaking, the check has
      // caught actual build problems.

      // The check doesn't really know that it got a bona fide implementation of
      // `quill-delta`, just that it's an instance of a class named `Delta`. We
      // define `forEach()` because that's the method that gets used to induce
      // an error which helps produce an informative message.
      class Delta {
        forEach(func) {
          func('x');
        }
      }

      const wrongDelta = new Delta();

      wrongDelta.ops = [];

      assert.throws(() => { BodyDelta.fromQuillForm(wrongDelta); }, /Divergent/);
    });
  });

  describe('constructor()', () => {
    describe('valid arguments', () => {
      const values = [
        [],
        [BodyOp.op_text('x')],
        [BodyOp.op_text('x', { bold: true })],
        [BodyOp.op_delete(123)],
        [BodyOp.op_retain(123)],
        [BodyOp.op_retain(123, { bold: true })],
        [BodyOp.op_text('x'), BodyOp.op_text('y', { bold: true })],
        [['text', 'hello']],
        [['retain', 123]],
        [['delete', 5], ['text', 'yo']]
      ];

      for (const v of values) {
        it(`succeeds for: ${inspect(v)}`, () => {
          new BodyDelta(v);
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
          assert.throws(() => new BodyDelta(v));
        });
      }
    });
  });

  describe('compose()', () => {
    it('returns an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result1 = BodyDelta.EMPTY.compose(BodyDelta.EMPTY, false);
      assert.instanceOf(result1, BodyDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = BodyDelta.EMPTY.compose(BodyDelta.EMPTY, true);
      assert.instanceOf(result2, BodyDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('rejects calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.compose(other, true));
    });
  });

  describe('diff()', () => {
    it('returns an empty result from `EMPTY.diff(EMPTY)`', () => {
      const result = BodyDelta.EMPTY.diff(BodyDelta.EMPTY);
      assert.instanceOf(result, BodyDelta);
      assert.deepEqual(result.ops, []);
    });

    it('rejects calls when `this` is not a document', () => {
      const delta = new BodyDelta([BodyOp.op_retain(10)]);
      const other = BodyDelta.EMPTY;
      assert.throws(() => delta.diff(other));
    });

    it('rejects calls when `other` is not a document', () => {
      const delta = BodyDelta.EMPTY;
      const other = new BodyDelta([BodyOp.op_retain(10)]);
      assert.throws(() => delta.diff(other));
    });

    it('rejects calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.diff(other));
    });
  });

  describe('compose() / diff()', () => {
    // These tests take composition triples `origDoc + change = newDoc` and test
    // `compose()` and `diff()` in various combinations.
    function test(label, origDoc, change, newDoc) {
      origDoc = new BodyDelta(origDoc);
      change  = new BodyDelta(change);
      newDoc  = new BodyDelta(newDoc);

      describe(label, () => {
        it('produces the expected composition', () => {
          const result = origDoc.compose(change, true);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });

        it('produces the expected diff', () => {
          const result = origDoc.diff(newDoc);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, change.ops);
        });

        it('produces the new document when composing the orig document with the diff', () => {
          const diff   = origDoc.diff(newDoc);
          const result = origDoc.compose(diff, true);
          assert.instanceOf(result, BodyDelta);
          assert.deepEqual(result.ops, newDoc.ops);
        });
      });
    }

    test('full replacement (except for required end-of-delta newline)',
      [BodyOp.op_text('111\n')],
      [BodyOp.op_text('222'), BodyOp.op_delete(3)],
      [BodyOp.op_text('222\n')]);
    test('insert at start',
      [BodyOp.op_text('111\n')],
      [BodyOp.op_text('222')],
      [BodyOp.op_text('222111\n')]);
    test('append at end',
      [BodyOp.op_text('111\n')],
      [BodyOp.op_retain(4), BodyOp.op_text('222\n')],
      [BodyOp.op_text('111\n222\n')]);
    test('append just before end',
      [BodyOp.op_text('111\n')],
      [BodyOp.op_retain(3), BodyOp.op_text('222')],
      [BodyOp.op_text('111222\n')]);
    test('surround',
      [BodyOp.op_text('111\n')],
      [BodyOp.op_text('222'), BodyOp.op_retain(4), BodyOp.op_text('333\n')],
      [BodyOp.op_text('222111\n333\n')]);
    test('replace one middle bit',
      [BodyOp.op_text('Drink more Slurm.\n')],
      [BodyOp.op_retain(6), BodyOp.op_text('LESS'), BodyOp.op_delete(4)],
      [BodyOp.op_text('Drink LESS Slurm.\n')]);
    test('replace two middle bits',
      [BodyOp.op_text('[[hello]] [[goodbye]]\n')],
      [
        BodyOp.op_retain(2), BodyOp.op_text('YO'), BodyOp.op_delete(5), BodyOp.op_retain(5),
        BodyOp.op_text('LATER'), BodyOp.op_delete(7)
      ],
      [BodyOp.op_text('[[YO]] [[LATER]]\n')]);
  });

  describe('endsWithNewlineOrIsEmpty()', () => {
    it('returns `true` for `EMPTY`', () => {
      assert.isTrue(BodyDelta.EMPTY.endsWithNewlineOrIsEmpty());
    });

    it('returns `true` for instances that have a text final op with a newline at the end', () => {
      function test(...ops) {
        const delta = new BodyDelta(ops);
        assert.isTrue(delta.endsWithNewlineOrIsEmpty());
      }

      test(BodyOp.op_text('\n'));
      test(BodyOp.op_text('x\n'));
      test(BodyOp.op_text('xyz\n'));
      test(BodyOp.op_text('x\ny\nz\n'));

      test(BodyOp.op_text('Boop! '), BodyOp.op_text('\n'));
      test(BodyOp.op_text('Boop! '), BodyOp.op_text('x\n'));
      test(BodyOp.op_text('Boop! '), BodyOp.op_text('xyz\n'));
      test(BodyOp.op_text('Boop! '), BodyOp.op_text('x\ny\nz\n'));

      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('\n'));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('x\n'));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('xyz\n'));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('x\ny\nz\n'));
    });

    it('returns `false` for instances that have a text final op without a newline at the end', () => {
      function test(...ops) {
        const delta = new BodyDelta(ops);
        assert.isFalse(delta.endsWithNewlineOrIsEmpty());
      }

      test(BodyOp.op_text('x'));
      test(BodyOp.op_text('xyz'));
      test(BodyOp.op_text('x\ny\nz'));

      test(BodyOp.op_text('Boop! '), BodyOp.op_text('x'));
      test(BodyOp.op_text('Boop! '), BodyOp.op_text('xyz'));
      test(BodyOp.op_text('Boop! '), BodyOp.op_text('x\ny\nz'));

      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('x'));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('xyz'));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_text('x\ny\nz'));
    });

    it('returns `false` for instances that do not have a text final op', () => {
      function test(...ops) {
        const delta = new BodyDelta(ops);
        assert.isFalse(delta.endsWithNewlineOrIsEmpty());
      }

      test(BodyOp.op_embed('florp', 914));
      test(BodyOp.op_text('Boop!'), BodyOp.op_embed('florp', 914));
      test(BodyOp.op_embed('florp', 914), BodyOp.op_embed('florp', 914));
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
      function test(ops) {
        const delta = new BodyDelta(ops);
        assert.isTrue(delta.equals(delta));
      }

      test([]);
      test([BodyOp.op_text('aaa')]);
      test([BodyOp.op_text('aaa'), BodyOp.op_text('bbb')]);
    });

    it('returns `true` when passed an identically-constructed value', () => {
      function test(ops) {
        const d1 = new BodyDelta(ops);
        const d2 = new BodyDelta(ops);
        assert.isTrue(d1.equals(d2));
        assert.isTrue(d2.equals(d1));
      }

      test([]);
      test([BodyOp.op_text('aaa')]);
      test([BodyOp.op_text('aaa'), BodyOp.op_text('bbb')]);
    });

    it('returns `true` when equal ops are not also `===`', () => {
      const ops1 = [BodyOp.op_text('aaa'), BodyOp.op_text('bbb')];
      const ops2 = [BodyOp.op_text('aaa'), BodyOp.op_text('bbb')];
      const d1 = new BodyDelta(ops1);
      const d2 = new BodyDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('returns `false` when array lengths differ', () => {
      const op1 = BodyOp.op_text('aaa');
      const op2 = BodyOp.op_text('bbb');
      const d1 = new BodyDelta([op1]);
      const d2 = new BodyDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('returns `false` when corresponding ops differ', () => {
      function test(ops1, ops2) {
        const d1 = new BodyDelta(ops1);
        const d2 = new BodyDelta(ops2);

        assert.isFalse(d1.equals(d2));
        assert.isFalse(d2.equals(d1));
      }

      const op1 = BodyOp.op_text('foo');
      const op2 = BodyOp.op_text('bar');
      const op3 = BodyOp.op_text('baz');
      const op4 = BodyOp.op_text('biff');
      const op5 = BodyOp.op_text('quux');

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
      const delta = new BodyDelta([]);

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
      const values = [
        [],
        [BodyOp.op_text('line 1')],
        [BodyOp.op_text('line 1'), BodyOp.op_text('\n')],
        [BodyOp.op_text('line 1'), BodyOp.op_text('\n'), BodyOp.op_text('line 2')],
        [BodyOp.op_embed('blort', 123), BodyOp.op_text('\n')],
      ];

      for (const v of values) {
        it(`returns \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new BodyDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const values = [
        [BodyOp.op_retain(37)],
        [BodyOp.op_delete(914)],
        [BodyOp.op_retain(37, { bold: true })],
        [BodyOp.op_text('line 1'), BodyOp.op_retain(9)],
        [BodyOp.op_text('line 1'), BodyOp.op_retain(14), BodyOp.op_text('\n')],
        [BodyOp.op_text('line 1'), BodyOp.op_text('\n'), BodyOp.op_retain(23), BodyOp.op_text('line 2')],
        [BodyOp.op_embed('blort', 123), BodyOp.op_retain(10), BodyOp.op_text('\n')],
        [BodyOp.op_embed('blort', 123), BodyOp.op_delete(123)]
      ];

      for (const v of values) {
        it(`returns \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(new BodyDelta(v).isDocument());
        });
      }
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new BodyDelta([]),
        BodyDelta.EMPTY,
      ];

      for (const v of values) {
        it(`returns \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        [BodyOp.op_text('x')],
        [BodyOp.op_text('line 1'), BodyOp.op_text('\n'), BodyOp.op_text('line 2')],
        [BodyOp.op_retain(100)]
      ];

      for (const v of values) {
        it(`returns \`false\` for: ${inspect(v)}`, () => {
          const delta = new BodyDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });

  describe('toQuillForm()', () => {
    it('produces `Delta` instances with appropriately-converted ops', () => {
      function test(ops) {
        const delta  = new BodyDelta(ops);
        const result = delta.toQuillForm();
        assert.instanceOf(result, Text.Delta);

        const origOps = delta.ops;
        const quillOps = result.ops;

        assert.strictEqual(origOps.length, quillOps.length);
        for (let i = 0; i < origOps.length; i++) {
          const op1 = origOps[i].toQuillForm();
          const op2 = quillOps[i];
          assert.deepEqual(op2, op1);
        }
      }

      test([]);
      test([BodyOp.op_embed('zither', 123)]);
      test([BodyOp.op_text('blort')]);
      test([BodyOp.op_retain(123)]);
      test([
        BodyOp.op_retain(123, { bold: true }),
        BodyOp.op_delete(10),
        BodyOp.op_text('foo')
      ]);
    });
  });

  describe('transform()', () => {
    it('returns an empty result from `EMPTY.transform(EMPTY, *)`', () => {
      const result1 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, false);
      assert.instanceOf(result1, BodyDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = BodyDelta.EMPTY.transform(BodyDelta.EMPTY, true);
      assert.instanceOf(result2, BodyDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('rejects calls when `other` is not an instance of the class', () => {
      const delta = BodyDelta.EMPTY;
      const other = 'blort';
      assert.throws(() => delta.transform(other, true));
    });

    it('rejects calls when `thisIsFirst` is not a boolean', () => {
      const delta = BodyDelta.EMPTY;
      assert.throws(() => delta.transform(delta, 'blort'));
    });

    it('produces the expected transformations', () => {
      function test(d1, d2, expectedTrue, expectedFalse = expectedTrue) {
        d1 = new BodyDelta(d1);
        d2 = new BodyDelta(d2);

        const xformTrue  = d1.transform(d2, true);
        const xformFalse = d1.transform(d2, false);

        assert.deepEqual(xformTrue.ops,  expectedTrue);
        assert.deepEqual(xformFalse.ops, expectedFalse);
      }

      test(
        [BodyOp.op_text('blort')],
        [BodyOp.op_text('blort')],
        [BodyOp.op_retain(5), BodyOp.op_text('blort')],
        [BodyOp.op_text('blort')]);
      test(
        [BodyOp.op_delete(10)],
        [BodyOp.op_delete(10)],
        []);
      test(
        [BodyOp.op_delete(10)],
        [BodyOp.op_delete(10), BodyOp.op_text('florp')],
        [BodyOp.op_text('florp')]);
      test(
        [BodyOp.op_text('111')],
        [BodyOp.op_text('222')],
        [BodyOp.op_retain(3), BodyOp.op_text('222')],
        [BodyOp.op_text('222')]);
      test(
        [BodyOp.op_retain(10), BodyOp.op_text('111')],
        [BodyOp.op_retain(20), BodyOp.op_text('222')],
        [BodyOp.op_retain(23), BodyOp.op_text('222')]);
    });
  });
});
