// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { BaseDelta } from 'doc-common';

import MockDelta from './MockDelta';
import MockOp from './MockOp';

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

describe('doc-common/BaseDelta', () => {
  describe('.EMPTY', () => {
    const EMPTY = MockDelta.EMPTY;

    it('should be an instance of the subclass', () => {
      assert.instanceOf(EMPTY, MockDelta);
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
        MockDelta.VALID_OPS,
        MockDelta.NOT_DOCUMENT_OPS,
        [MockDelta.makeOp('x'), MockDelta.makeOp('y')]
      ];

      for (const v of values) {
        it(`should succeed for: ${inspect(v)}`, () => {
          new MockDelta(v);
        });
      }
    });

    describe('invalid arguments', () => {
      const values = [
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
        MockDelta.INVALID_OPS
      ];

      for (const v of values) {
        it(`should fail for: ${inspect(v)}`, () => {
          assert.throws(() => new MockDelta(v));
        });
      }
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      function test(ops) {
        const delta = new MockDelta(ops);
        assert.isTrue(delta.equals(delta));
      }

      test([]);
      test(MockDelta.VALID_OPS);
      test(MockDelta.NOT_DOCUMENT_OPS);
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(ops) {
        const d1 = new MockDelta(ops);
        const d2 = new MockDelta(ops);
        assert.isTrue(d1.equals(d2));
        assert.isTrue(d2.equals(d1));
      }

      test([]);
      test(MockDelta.VALID_OPS);
      test(MockDelta.NOT_DOCUMENT_OPS);
    });

    it('should return `true` when equal ops are not also `===`', () => {
      const ops1 = [MockDelta.makeOp('foo'), MockDelta.makeOp('bar')];
      const ops2 = [MockDelta.makeOp('foo'), MockDelta.makeOp('bar')];
      const d1 = new MockDelta(ops1);
      const d2 = new MockDelta(ops2);

      assert.isTrue(d1.equals(d2));
      assert.isTrue(d2.equals(d1));
    });

    it('should return `false` when array lengths differ', () => {
      const op1 = MockDelta.makeOp('foo');
      const op2 = MockDelta.makeOp('bar');
      const d1 = new MockDelta([op1]);
      const d2 = new MockDelta([op1, op2]);

      assert.isFalse(d1.equals(d2));
      assert.isFalse(d2.equals(d1));
    });

    it('should return `false` when corresponding ops differ', () => {
      function test(ops1, ops2) {
        const d1 = new MockDelta(ops1);
        const d2 = new MockDelta(ops2);

        assert.isFalse(d1.equals(d2));
        assert.isFalse(d2.equals(d1));
      }

      const op1 = MockDelta.makeOp('foo');
      const op2 = MockDelta.makeOp('bar');
      const op3 = MockDelta.makeOp('baz');
      const op4 = MockDelta.makeOp('biff');
      const op5 = MockDelta.makeOp('quux');

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
        it(`should return \`true\` for: ${inspect(v)}`, () => {
          assert.isTrue(new MockDelta(v).isDocument());
        });
      }
    });

    describe('`false` cases', () => {
      assert.isFalse(new MockDelta(MockDelta.NOT_DOCUMENT_OPS).isDocument());
    });
  });

  describe('isEmpty()', () => {
    describe('valid empty values', () => {
      const values = [
        new MockDelta([]),
        MockDelta.EMPTY,
      ];

      for (const v of values) {
        it(`should return \`true\` for: ${inspect(v)}`, () => {
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
        it(`should return \`false\` for: ${inspect(v)}`, () => {
          const delta = new MockDelta(v);
          assert.isFalse(delta.isEmpty());
        });
      }
    });
  });
});
