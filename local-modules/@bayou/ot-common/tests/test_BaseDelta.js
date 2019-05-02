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
class AnotherDelta extends BaseDelta {
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
    it('calls the `_impl` even when `other` is empty', () => {
      let implCalled = false;
      class TestDelta extends MockDelta {
        _impl_compose(...args) {
          implCalled = true;
          return super._impl_compose(...args);
        }
      }

      const docDelta    = new TestDelta([['x']]);
      const nondocDelta = new TestDelta(MockDelta.NOT_DOCUMENT_OPS);

      implCalled = false;
      assert.deepEqual(docDelta.compose(TestDelta.EMPTY, true), new TestDelta([['composedDoc', 1]]));
      assert.isTrue(implCalled);

      implCalled = false;
      assert.deepEqual(docDelta.compose(new TestDelta([]), true), new TestDelta([['composedDoc', 1]]));
      assert.isTrue(implCalled);

      implCalled = false;
      assert.deepEqual(nondocDelta.compose(TestDelta.EMPTY, false), new TestDelta([['composedNotDoc', 1]]));
      assert.isTrue(implCalled);

      implCalled = false;
      assert.deepEqual(nondocDelta.compose(new TestDelta([]), false), new TestDelta([['composedNotDoc', 1]]));
      assert.isTrue(implCalled);
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
    // Common tests for both sub-cases, none of which should call through to
    // `_impl_*()` methods.
    function commonTests(DeltaClass, checkCount) {
      it('returns `this` given an empty `deltas`', () => {
        const docDelta    = new DeltaClass([['x']]);
        const nondocDelta = new DeltaClass(MockDelta.NOT_DOCUMENT_OPS);

        assert.strictEqual(docDelta.composeAll([], true), docDelta);
        assert.strictEqual(nondocDelta.composeAll([], false), nondocDelta);
        checkCount();
      });

      it('rejects instances of the wrong delta class', () => {
        const delta = new DeltaClass([['x']]);
        const good  = new DeltaClass([['yes']]);
        const bad   = AnotherDelta.EMPTY;

        assert.throws(() => delta.composeAll([bad]), /badValue/);
        assert.throws(() => delta.composeAll([bad, good]), /badValue/);
        assert.throws(() => delta.composeAll([good, bad]), /badValue/);
        checkCount();
      });

      it('rejects non-delta array elements', () => {
        const delta = new DeltaClass([['x']]);
        const other = new DeltaClass([['yes']]);

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
        checkCount();
      });

      it('rejects non-array arguments', () => {
        const delta = new DeltaClass([['x']]);

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
        checkCount();
      });
    }

    describe('subclass that does not override `_impl_composeAll()`', () => {
      let callCount = 0;

      function resetCount() {
        callCount = 0;
      }

      class TestDelta extends MockDelta {
        _impl_compose(...args) {
          callCount++;
          return super._impl_compose(...args);
        }
      }

      commonTests(TestDelta, () => assert.strictEqual(callCount, 0));

      it('calls through to `_impl_compose()` the appropriate number of times, returning the expected ultimate result', () => {
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

          resetCount();
          const docResult = docDelta.composeAll(deltas, true);
          assert.strictEqual(callCount, count);
          assert.deepEqual(
            docResult,
            new TestDelta([['composedDoc', count], ['yes', count + 100]]));

          resetCount();
          const nondocResult = nondocDelta.composeAll(deltas, false);
          assert.strictEqual(callCount, count);
          assert.deepEqual(
            nondocResult,
            new TestDelta([['composedNotDoc', count], ['yes', count + 100]]));
        }

        test(1);
        test(2);
        test(10);

        test(2, 1);
        test(6, 2);
        test(23, 7);
      });
    });

    describe('subclass that overrides `_impl_composeAll()`', () => {
      let composeCount    = 0;
      let composeAllCount = 0;

      function resetCount() {
        composeCount    = 0;
        composeAllCount = 0;
      }

      class TestDelta extends MockDelta {
        _impl_compose(...args) {
          composeCount++;
          return super._impl_compose(...args);
        }

        _impl_composeAll(deltas, wantDocument) {
          composeAllCount++;

          let result = this;

          for (const d of deltas) {
            result = result._impl_compose(d, wantDocument);
            composeCount--; // Counteract the counting of the call just made.
          }

          return result;
        }
      }

      commonTests(TestDelta, () => {
        assert.strictEqual(composeCount, 0);
        assert.strictEqual(composeAllCount, 0);
      });

      it('calls through to `_impl_compose()` when `deltas.length === 1`', () => {
        const docDelta    = new TestDelta([['x']]);
        const nondocDelta = new TestDelta(MockDelta.NOT_DOCUMENT_OPS);

        resetCount();
        const result1 = docDelta.composeAll([TestDelta.EMPTY], true);
        assert.strictEqual(composeCount, 1);
        assert.strictEqual(composeAllCount, 0);
        assert.deepEqual(result1, new TestDelta([['composedDoc', 1]]));

        resetCount();
        const result2 = nondocDelta.composeAll([TestDelta.EMPTY], false);
        assert.strictEqual(composeCount, 1);
        assert.strictEqual(composeAllCount, 0);
        assert.deepEqual(result2, new TestDelta([['composedNotDoc', 1]]));

        resetCount();
        const result3 = docDelta.composeAll([new TestDelta([['yes']])], true);
        assert.strictEqual(composeCount, 1);
        assert.strictEqual(composeAllCount, 0);
        assert.deepEqual(result3, new TestDelta([['composedDoc', 1], ['yes']]));

        resetCount();
        const result4 = nondocDelta.composeAll([new TestDelta([['yes']])], false);
        assert.strictEqual(composeCount, 1);
        assert.strictEqual(composeAllCount, 0);
        assert.deepEqual(result4, new TestDelta([['composedNotDoc', 1], ['yes']]));
      });

      it('calls through to `_impl_composeAll()` exactly once, returning the expected ultimate result', () => {
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

          resetCount();
          const docResult = docDelta.composeAll(deltas, true);
          assert.strictEqual(composeCount, 0);
          assert.strictEqual(composeAllCount, 1);
          assert.deepEqual(
            docResult,
            new TestDelta([['composedDoc', count], ['yes', count + 100]]));

          resetCount();
          const nondocResult = nondocDelta.composeAll(deltas, false);
          assert.strictEqual(composeCount, 0);
          assert.strictEqual(composeAllCount, 1);
          assert.deepEqual(
            nondocResult,
            new TestDelta([['composedNotDoc', count], ['yes', count + 100]]));
        }

        test(2);
        test(3);
        test(10);

        test(2, 1);
        test(6, 2);
        test(23, 7);
      });
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
