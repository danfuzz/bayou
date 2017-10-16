// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { DataUtil, Functor } from 'util-common';

import { MockOp } from 'doc-common/mocks';

describe('doc-common/BaseOp', () => {
  describe('constructor()', () => {
    it('should accept a string `name argument', () => {
      const result = new MockOp('blort');
      assert.strictEqual(result.payload.name, 'blort');
    });

    it('should accept at least ten arguments after the name', () => {
      const result = new MockOp('blort', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      assert.strictEqual(result.payload.args.length, 10);
    });

    it('should produce a frozen instance with a frozen payload', () => {
      const op = new MockOp('blort');
      assert.isFrozen(op);
      assert.isFrozen(op.payload);
    });

    it('should have all frozen payload arguments even when given non-frozen ones', () => {
      function test(...args) {
        const op      = new MockOp('blort', ...args);
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

    it('should reject payloads with arguments that are neither frozen nor deep-freezable data', () => {
      function test(...args) {
        assert.throws(() => new MockOp(...args));
      }

      test(new Map());
      test(new Functor('x', 1, 2));
      test(/blort/);
      test(() => 'woo');
      test(1, 2, 3, new Map(), 4, 5, 6);
    });

    it('should reject non-string first arguments', () => {
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
    it('should be a functor based on the constructor arguments', () => {
      const payload = new Functor('x', 1, 2, 3);
      const op = new MockOp(payload.name, ...payload.args);

      assert.deepEqual(op.payload, payload);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      const op = new MockOp('x', 'y', 'z');
      assert.isTrue(op.equals(op));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const op1 = new MockOp(...args);
        const op2 = new MockOp(...args);
        assert.isTrue(op1.equals(op2));
      }

      test('x');
      test('foo', 1);
      test('bar', ['x']);
      test('baz', { a: 10, b: 20 });
    });

    it('should return `false` when payloads differ', () => {
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

    it('should return `false` when passed a non-instance', () => {
      const op = new MockOp('x');

      assert.isFalse(op.equals(undefined));
      assert.isFalse(op.equals(null));
      assert.isFalse(op.equals('not an op'));
      assert.isFalse(op.equals(['also', 'not', 'an', 'op']));
      assert.isFalse(op.equals({ not: 'an op' }));
    });
  });
});
