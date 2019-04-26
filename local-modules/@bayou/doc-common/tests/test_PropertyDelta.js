// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { PropertyDelta, PropertyOp } from '@bayou/doc-common';

import { MockDelta } from '@bayou/ot-common/mocks';

describe('@bayou/doc-common/PropertyDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = PropertyDelta.EMPTY;

    it('should be an instance of `PropertyDelta`', () => {
      assert.instanceOf(EMPTY, PropertyDelta);
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
        [PropertyOp.op_set('x', 'y')],
        [PropertyOp.op_set('x', ['y'])],
        [PropertyOp.op_set('x', { y: 10 })],
        [PropertyOp.op_delete('foo')],
        [['set', 'x', 10]],
        [['delete', 'foo']]
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          new PropertyDelta(v);
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
          assert.throws(() => new PropertyDelta(v));
        });
      }
    });
  });

  describe('compose()', () => {
    it('returns an empty result from `EMPTY.compose(EMPTY)`', () => {
      const result1 = PropertyDelta.EMPTY.compose(PropertyDelta.EMPTY, false);
      assert.instanceOf(result1, PropertyDelta);
      assert.deepEqual(result1.ops, []);

      const result2 = PropertyDelta.EMPTY.compose(PropertyDelta.EMPTY, true);
      assert.instanceOf(result2, PropertyDelta);
      assert.deepEqual(result2.ops, []);
    });

    it('rejects calls when `other` is not an instance of the class', () => {
      const delta = PropertyDelta.EMPTY;

      assert.throws(() => delta.compose('blort', false));
      assert.throws(() => delta.compose(null, false));
      assert.throws(() => delta.compose(new MockDelta([]), false));
    });

    it('should result in no more than one op per named property, with `other` taking precedence', () => {
      function test(ops1, ops2, expectOps) {
        const d1     = new PropertyDelta(ops1);
        const d2     = new PropertyDelta(ops2);
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

      const op1 = PropertyOp.op_set('aaa', 'bbb');
      const op2 = PropertyOp.op_set('aaa', 'ccc');
      const op3 = PropertyOp.op_set('aaa', 'ddd');
      const op4 = PropertyOp.op_set('aaa', 'eee');
      const op5 = PropertyOp.op_set('bbb', 'ccc');
      const op6 = PropertyOp.op_set('bbb', 'ddd');
      const op7 = PropertyOp.op_delete('aaa');

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

    it('does not include deletions when `wantDocument` is `true`', () => {
      const op1    = PropertyOp.op_set('aaa', '111');
      const op2    = PropertyOp.op_set('bbb', '222');
      const op3    = PropertyOp.op_set('ccc', '333');
      const op4    = PropertyOp.op_delete('bbb');
      const op5    = PropertyOp.op_delete('ddd');
      const d1     = new PropertyDelta([op1, op2]);
      const d2     = new PropertyDelta([op3, op4, op5]);
      const result = d1.compose(d2, true);

      assert.sameMembers(result.ops, [op1, op3]);
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
      function test(ops) {
        const delta = new PropertyDelta(ops);
        assert.isTrue(delta.equals(delta));
      }

      test([]);
      test([PropertyOp.op_set('aaa', 'bbb')]);
      test([PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_delete('ccc')]);
    });

    it('returns `true` when passed an identically-constructed value', () => {
      function test(ops) {
        const d1 = new PropertyDelta(ops);
        const d2 = new PropertyDelta(ops);
        assert.isTrue(d1.equals(d2));
        assert.isTrue(d2.equals(d1));
      }

      test([]);
      test([PropertyOp.op_set('aaa', 'bbb')]);
      test([PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_delete('ccc')]);
    });

    it('returns `true` when equal ops are not also `===`', () => {
      const ops1 = [PropertyOp.op_set('aaa', 'bbb')];
      const ops2 = [PropertyOp.op_set('aaa', 'bbb')];
      const d1 = new PropertyDelta(ops1);
      const d2 = new PropertyDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('returns `false` when array lengths differ', () => {
      const op1 = PropertyOp.op_set('aaa', 'bbb');
      const op2 = PropertyOp.op_delete('ccc');
      const d1 = new PropertyDelta([op1]);
      const d2 = new PropertyDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('returns `false` when corresponding ops differ', () => {
      function test(ops1, ops2) {
        const d1 = new PropertyDelta(ops1);
        const d2 = new PropertyDelta(ops2);

        assert.isFalse(d1.equals(d2));
        assert.isFalse(d2.equals(d1));
      }

      const op1 = PropertyOp.op_set('aaa', 'bbb');
      const op2 = PropertyOp.op_set('aaa', 'ccc');
      const op3 = PropertyOp.op_set('bbb', 'ccc');
      const op4 = PropertyOp.op_delete('ddd');
      const op5 = PropertyOp.op_delete('eee');

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
      const delta = new PropertyDelta([]);

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
        [PropertyOp.op_set('aaa', 'bbb')],
        [PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_set('ccc', 'ddd')],
        [
          PropertyOp.op_set('aaa', 'bbb'),
          PropertyOp.op_set('ccc', 'ddd'),
          PropertyOp.op_set('eee', 'fff')
        ]
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new PropertyDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      const values = [
        [PropertyOp.op_delete('xyz')],
        [PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_set('aaa', 'ccc')]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          assert.isFalse(new PropertyDelta(v).isDocument());
        });
      }
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new PropertyDelta([]),
        PropertyDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        [PropertyOp.op_set('aaa', 'bbb')],
        [PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_set('ccc', 'ddd')],
        [PropertyOp.op_set('aaa', 'bbb'), PropertyOp.op_delete('aaa')],
        [PropertyOp.op_delete('xyz')]
      ];

      for (const v of values) {
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = new PropertyDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
