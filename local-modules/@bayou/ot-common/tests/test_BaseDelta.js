// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseDelta } from '@bayou/ot-common';
import { DataUtil } from '@bayou/util-common';

import { MockDelta, MockOp } from '@bayou/ot-common/mocks';

/**
 * Second mock "delta" class for testing.
 */
export default class AnotherDelta extends BaseDelta {
  _impl_isDocument() {
    return true;
  }

  static get _impl_opClass() {
    return MockOp;
  }
}

describe('@bayou/ot-common/BaseDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = MockDelta.EMPTY;

    it('is an instance of the subclass', () => {
      assert.instanceOf(EMPTY, MockDelta);
    });

    it('is a frozen object', () => {
      assert.isFrozen(EMPTY);
    });

    it('has an empty `ops`', () => {
      assert.lengthOf(EMPTY.ops, 0);
    });

    it('has a frozen `ops`', () => {
      assert.isFrozen(EMPTY.ops);
    });

    it('is `.isEmpty()`', () => {
      assert.isTrue(EMPTY.isEmpty());
    });
  });

  describe('constructor()', () => {
    describe('valid arguments', () => {
      const values = [
        MockDelta.VALID_OPS,
        MockDelta.NOT_DOCUMENT_OPS,
        [],
        [new MockOp('x'), new MockOp('y')],
        [['x']],
        [['x', 1, 2, 3]],
        [['x', 1], ['y', 2], ['z', 3]]
      ];

      for (const v of values) {
        it(`succeeds for: ${inspect(v)}`, () => {
          new MockDelta(v);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
        MockDelta.INVALID_OPS,
        null,
        undefined,
        123,
        'florp',
        { insert: 123 },
        new Map(),
        [null],
        [undefined],
        ['x'],
        [1, 2, 3],
        [[123]], // Because op constructors require an initial string argument.
        [['x'], new MockOp('y')], // Shouldn't mix the two forms.
        [new MockOp('y'), ['x']]  // Likewise.
      ];

      for (const v of values) {
        it(`fails for: ${inspect(v)}`, () => {
          assert.throws(() => new MockDelta(v));
        });
      }
    });

    it('converts array-of-array arguments into constructed ops', () => {
      function test(...argses) {
        const ops = argses.map(a => new MockOp(...a));
        const result = new MockDelta(argses);

        assert.lengthOf(result.ops, ops.length);

        for (let i = 0; i < ops.length; i++) {
          assert.deepEqual(result.ops[i], ops[i]);
        }
      }

      test(['z']);
      test(['z', 1]);
      test(['z', 1, 2, 3, 4, 'florp']);
      test(['x'], ['y'], ['z']);
      test(['x', ['a']], ['y', { b: 10 }], ['z', [[['pdq']]]]);
    });
  });

  describe('compose()', () => {
    it('returns `this` when `other` is empty', () => {
      class TestDelta extends MockDelta {
        _impl_compose(other_unused, wantDocument_unused) {
          throw new Error('should not have been called');
        }
      }

      const docDelta    = new TestDelta([['x']]);
      const nondocDelta = new TestDelta(MockDelta.NOT_DOCUMENT_OPS);

      assert.strictEqual(docDelta.compose(TestDelta.EMPTY, true), docDelta);
      assert.strictEqual(docDelta.compose(new TestDelta([]), true), docDelta);

      assert.strictEqual(nondocDelta.compose(TestDelta.EMPTY, false), nondocDelta);
      assert.strictEqual(nondocDelta.compose(new TestDelta([]), false), nondocDelta);
    });

    it('calls through to the impl when given valid arguments', () => {
      function test(ops1, ops2, wantDocument, expectOps) {
        const d1     = new MockDelta(ops1);
        const d2     = new MockDelta(ops2);
        const result = d1.compose(d2, wantDocument);

        expectOps = expectOps.map(a => new MockOp(...a));

        assert.instanceOf(result, MockDelta);
        assert.deepEqual(result.ops, expectOps);
      }

      test([], [['x']], false, [['composedNotDoc', 1], ['x']]);
      test([], [['x']], true,  [['composedDoc',    1], ['x']]);
    });

    it('rejects invalid `other` arguments', () => {
      function test(value) {
        const delta = MockDelta.EMPTY;
        assert.throws(() => { delta.compose(value, false); }, /badValue/);
      }

      test(undefined);
      test(null);
      test(0);
      test(1);
      test('blort');
      test(new Map());
    });

    it('rejects non-boolean `wantDocument` arguments', () => {
      function test(value) {
        const delta = MockDelta.EMPTY;
        assert.throws(() => { delta.compose(delta, value); }, /badValue/);
      }

      test(undefined);
      test(null);
      test(0);
      test(1);
      test('blort');
    });

    it('rejects a non-document `this` when `wantDocument` is `true`', () => {
      const delta = new MockDelta(MockDelta.NOT_DOCUMENT_OPS);
      assert.throws(() => { delta.compose(MockDelta.EMPTY, true); }, /badUse/);
    });
  });

  describe('composeAll()', () => {
    it('returns `this` given an empty `deltas`', () => {
      const docDelta    = new MockDelta([['x']]);
      const nondocDelta = new MockDelta(MockDelta.NOT_DOCUMENT_OPS);

      assert.strictEqual(docDelta.composeAll([], true), docDelta);
      assert.strictEqual(nondocDelta.composeAll([], false), nondocDelta);
    });

    it('returns `this` when `deltas` is non-empty but all instances are empty', () => {
      const docDelta    = new MockDelta([['x']]);
      const nondocDelta = new MockDelta(MockDelta.NOT_DOCUMENT_OPS);

      function test(count) {
        const deltas = [];
        for (let i = 0; i < count; i++) {
          deltas.push(MockDelta.EMPTY);
        }

        assert.strictEqual(docDelta.composeAll(deltas, true), docDelta);
        assert.strictEqual(nondocDelta.composeAll(deltas, false), nondocDelta);
      }

      test(1);
      test(2);
      test(10);
    });

    it('calls through to `compose()` the appropriate number of times returning the expected ultimate result', () => {
      let callCount = 0;

      class TestDelta extends MockDelta {
        _impl_compose(...args) {
          callCount++;
          return super._impl_compose(...args);
        }
      }

      const docDelta    = new TestDelta([['x']]);
      const nondocDelta = new TestDelta(MockDelta.NOT_DOCUMENT_OPS);

      function test(count, emptyCount = 0) {
        const deltas = [];
        for (let i = 0; i < count; i++) {
          deltas.push(new TestDelta([['yes', i + 101]]));
        }
        for (let i = 0, at = 5 % (count-1); i < emptyCount; i++, at = (at + 31) % (count-1)) {
          deltas[at] = TestDelta.EMPTY;
        }

        callCount = 0;
        const docResult = docDelta.composeAll(deltas, true);
        assert.strictEqual(callCount, count - emptyCount);
        assert.deepEqual(
          docResult,
          new TestDelta([['composedDoc', count - emptyCount], ['yes', count + 100]]));

        callCount = 0;
        const nondocResult = nondocDelta.composeAll(deltas, false);
        assert.strictEqual(callCount, count - emptyCount);
        assert.deepEqual(
          nondocResult,
          new TestDelta([['composedNotDoc', count - emptyCount], ['yes', count + 100]]));
      }

      test(1);
      test(2);
      test(10);

      test(2, 1);
      test(6, 2);
      test(23, 7);
    });

    it('rejects instances of the wrong delta class', () => {
      const delta = new MockDelta([['x']]);
      const good  = new MockDelta([['yes']]);
      const bad   = AnotherDelta.EMPTY;

      assert.throws(() => delta.composeAll([bad]), /badValue/);
      assert.throws(() => delta.composeAll([bad, good]), /badValue/);
      assert.throws(() => delta.composeAll([good, bad]), /badValue/);
    });

    it('rejects non-delta array elements', () => {
      const delta = new MockDelta([['x']]);
      const other = new MockDelta([['yes']]);

      function test(v) {
        assert.throws(() => delta.composeAll([v]), /badValue/);
        assert.throws(() => delta.composeAll([v, other]), /badValue/);
        assert.throws(() => delta.composeAll([other, v]), /badValue/);
      }

      test(undefined);
      test(null);
      test(false);
      test(123);
      test('blort');
      test([]);
      test(['florp']);
      test({ x: 10 });
      test(new Map());
      test(new MockOp('x'));
    });

    it('rejects non-array arguments', () => {
      const delta = new MockDelta([['x']]);

      function test(v) {
        assert.throws(() => delta.composeAll(v), /badValue/);
      }

      test(undefined);
      test(null);
      test(false);
      test(123);
      test('blort');
      test({ x: 10 });
      test(new Map());
      test(new MockOp('x'));
    });
  });

  describe('deconstruct()', () => {
    it('returns a data value', () => {
      const delta  = new MockDelta([['x', 1, 2, 3, [4, 5, 6]], ['y', { x: ['y'] }]]);
      const result = delta.deconstruct();

      assert.isTrue(DataUtil.isData(result));
    });

    it('returns an array of length one, which contains an array-of-arrays', () => {
      const delta  = new MockDelta([['x', 1], ['y', [1, 2]]]);
      const result = delta.deconstruct();

      assert.isArray(result);
      assert.lengthOf(result, 1);
      assert.isArray(result[0]);

      for (const a of result[0]) {
        assert.isArray(a);
      }
    });

    it('returns a value which successfully round-trips from and to a constructor argument', () => {
      function test(arg) {
        const delta1 = new MockDelta(arg);
        const result = delta1.deconstruct();
        const delta2 = new MockDelta(...result);

        assert.deepEqual(arg, result[0]);
        assert.deepEqual(delta1, delta2);
      }

      test([]);
      test([['x']]);
      test([['x', 1, 2, 3]]);
      test([['x', [1, 2, 3]]]);
      test([['x', { a: 10, b: 20 }]]);
      test([['x'], ['y'], ['z']]);
      test([['x', 1], ['y', 2], ['z', 3]]);
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
      function test(ops) {
        const delta = new MockDelta(ops);
        assert.isTrue(delta.equals(delta));
      }

      test([]);
      test(MockDelta.VALID_OPS);
      test(MockDelta.NOT_DOCUMENT_OPS);
    });

    it('returns `true` when passed an identically-constructed value', () => {
      function test(ops) {
        const d1 = new MockDelta(ops);
        const d2 = new MockDelta(ops);
        assert.isTrue(d1.equals(d2));
        assert.isTrue(d2.equals(d1));
      }

      test([]);
      test(MockDelta.VALID_OPS);
      test(MockDelta.NOT_DOCUMENT_OPS);
      test([new MockOp('x', 1), new MockOp('y', 2)]);
      test([['x'], ['y', 1, 2, 3]]);
    });

    it('returns `true` when equal ops are not also `===`', () => {
      const ops1 = [new MockOp('x'), new MockOp('y')];
      const ops2 = [new MockOp('x'), new MockOp('y')];
      const d1 = new MockDelta(ops1);
      const d2 = new MockDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('returns `false` when array lengths differ', () => {
      const op1 = new MockOp('x');
      const op2 = new MockOp('y');
      const d1 = new MockDelta([op1]);
      const d2 = new MockDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('returns `false` when corresponding ops differ', () => {
      function test(ops1, ops2) {
        const d1 = new MockDelta(ops1);
        const d2 = new MockDelta(ops2);

        assert.isFalse(d1.equals(d2));
        assert.isFalse(d2.equals(d1));
      }

      const op1 = new MockOp('x');
      const op2 = new MockOp('y');
      const op3 = new MockOp('z');
      const op4 = new MockOp('x', 1);
      const op5 = new MockOp('x', 2);

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
      const delta = new MockDelta([]);

      assert.isFalse(delta.equals(undefined));
      assert.isFalse(delta.equals(null));
      assert.isFalse(delta.equals(false));
      assert.isFalse(delta.equals(true));
      assert.isFalse(delta.equals(914));
      assert.isFalse(delta.equals(['not', 'a', 'delta']));
      assert.isFalse(delta.equals(new Map()));
      assert.isFalse(delta.equals(new AnotherDelta([])));
    });
  });

  describe('isDocument()', () => {
    describe('`true` cases', () => {
      const values = [
        [],
        MockDelta.VALID_OPS
      ];

      for (const v of values) {
        it(`returns \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new MockDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      it('returns `false` when appropriate', () => {
        assert.isFalse(new MockDelta(MockDelta.NOT_DOCUMENT_OPS).isDocument());
      });
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new MockDelta([]),
        MockDelta.EMPTY,
      ];

      for (const v of values) {
        it(`returns \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(v.isEmpty());
        });
      }
    });

    describe('valid non-empty values', () => {
      const values = [
        MockDelta.VALID_OPS,
        MockDelta.NOT_DOCUMENT_OPS
      ];

      for (const v of values) {
        it(`returns \`false\` for: ${inspect(v)}`, () => {
          const delta = new MockDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
