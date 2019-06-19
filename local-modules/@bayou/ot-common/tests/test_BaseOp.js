// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { DataUtil, Functor } from '@bayou/util-common';

import { MockOp } from '@bayou/ot-common/mocks';

describe('@bayou/ot-common/BaseOp', () => {
  describe('constructor()', () => {
    it('accepts a string `name argument', () => {
      const result = new MockOp('x');
      assert.strictEqual(result.payload.name, 'x');
    });

    it('accepts at least ten arguments after the name', () => {
      const result = new MockOp('x', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      assert.strictEqual(result.payload.args.length, 10);
    });

    it('produces a frozen instance with a frozen payload', () => {
      const op = new MockOp('x');
      assert.isFrozen(op);
      assert.isFrozen(op.payload);
    });

    it('has all frozen payload arguments even when given non-frozen ones', () => {
      function test(...args) {
        const op      = new MockOp('x', ...args);
        const gotArgs = op.payload.args;

        for (const arg of gotArgs) {
          if (DataUtil.isData(arg)) {
            assert.isTrue(DataUtil.isDeepFrozen(arg), inspect(arg));
          } else {
            assert.isFrozen(arg);
          }
        }
      }

      test(1);
      test(1, 'foo');
      test(1, 'foo', Symbol('bar'));
      test([]);
      test([1, 2, 3]);
      test([[4, 5, 6]]);
      test([[[7, 8, 9]]]);
      test([1], [2, [3, [4]]], ['florp']);
      test({});
      test({ a: 10 });
      test({ a: { b: 20 }, c: 30 });
      test({ a: { b: { c: 30 } }, d: [[[[['like']]]]] });
    });

    it('rejects payloads with arguments that are neither frozen nor deep-freezable data', () => {
      function test(...args) {
        assert.throws(() => new MockOp('x', ...args));
      }

      test(new Map());
      test([1, 2, new Set()], 3);
      test('foo', 3, [new Set()], 4);
      test(/blort/);
      test(() => 'woo');
      test(1, 2, 3, new Map(), 4, 5, 6);

      // **TODO:** This should arguably fail, in that `Set` can't be
      // deep-frozen. The issue is probably that the `BaseOp` constructor
      // doesn't actually try to deep-freeze its arguments, just single-level
      // freeze.
      //test(new Functor('x', 1, 2, new Set()));
    });

    it('rejects non-string first arguments', () => {
      function test(v) {
        assert.throws(() => new MockOp(v));
      }

      test(undefined);
      test(null);
      test(['blort']);
      test({ x: 'blort' });
    });
  });

  describe('.payload', () => {
    it('is a functor based on the constructor arguments', () => {
      const payload = new Functor('x', 1, 2, 3);
      const op = new MockOp(payload.name, ...payload.args);

      assert.deepEqual(op.payload, payload);
    });
  });

  describe('.roughSize', () => {
    it('calls through to the `impl`', () => {
      const op = new MockOp('snap');

      assert.strictEqual(op.roughSize, 1004); // name + 1000 per `MockOp` definition.
    });

    it('rejects a bogus subclass `impl`', () => {
      function test(v) {
        class BadOp extends MockOp {
          _impl_roughSize() {
            return v;
          }
        }

        const op = new BadOp('x');
        assert.throws(() => op.roughSize, /badValue/);
      }

      test(0);
      test(-1);
      test(123.123);
      test(null);
      test('x');
    });
  });

  describe('deconstruct()', () => {
    it('returns an array data value', () => {
      const op     = new MockOp('x', ['florp', 'like'], { timeline: 'sideways' });
      const result = op.deconstruct();

      assert.isArray(result);
      assert.isTrue(DataUtil.isData(result));
    });

    it('returns a value which successfully round-trips from and to constructor arguments', () => {
      function test(...args) {
        const op1    = new MockOp(...args);
        const result = op1.deconstruct();
        const op2    = new MockOp(...result);

        assert.deepEqual(args, result);
        assert.deepEqual(op1, op2);
      }

      test('x');
      test('y', 1, 2, 3);
      test('z', ['florp', 'like']);
      test('x', { timeline: 'sideways' });
      test('y', [[[[[[[[[['floomp']]]]]]]]]]);
    });
  });

  describe('equals()', () => {
    it('returns `true` when passed itself', () => {
      const op = new MockOp('x', 'y', 'z');
      assert.isTrue(op.equals(op));
    });

    it('returns `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const op1 = new MockOp(...args);
        const op2 = new MockOp(...args);
        assert.isTrue(op1.equals(op2));
      }

      test('x');
      test('y', 1);
      test('z', ['x']);
      test('z', { a: 10, b: 20 });
    });

    it('returns `false` when payloads differ', () => {
      function test(p1, p2) {
        const op1 = new MockOp(...p1);
        const op2 = new MockOp(...p2);
        assert.isFalse(op1.equals(op2));
        assert.isFalse(op2.equals(op1));
      }

      test(['x'],             ['y']);
      test(['x', 'florp'],    ['y', 'florp']);
      test(['x'],             ['x', 1]);
      test(['x', 1],          ['x', 2]);
      test(['x', 1, 2],       ['x', 2]);
      test(['x', 1, 2],       ['x', 1, 2, 3]);
      test(['x', 1, 2],       ['x', 1, 2, null]);
      test(['x', 1, 2, null], ['x', 1, 2, undefined]);
      test(['x', { a: 10 }],  ['x', { a: 20 }]);
      test(['x', { a: 10 }],  ['x', { a: 10, c: 'foo' }]);
    });

    it('returns `false` when passed a non-instance', () => {
      const op = new MockOp('x');

      assert.isFalse(op.equals(undefined));
      assert.isFalse(op.equals(null));
      assert.isFalse(op.equals('not an op'));
      assert.isFalse(op.equals(['also', 'not', 'an', 'op']));
      assert.isFalse(op.equals({ not: 'an op' }));
    });
  });
});
