// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Functor } from 'util-common';

import MockOp from './MockOp';

describe('doc-common/BaseOp', () => {
  describe('constructor()', () => {
    it('should accept a functor argument', () => {
      new MockOp(new Functor('blort'));
    });

    it('should produce a frozen instance', () => {
      const op = new MockOp(new Functor('blort'));
      assert.isFrozen(op);
    });

    it('should reject non-functor arguments', () => {
      function test(v) {
        assert.throws(() => new MockOp(v));
      }

      test(undefined);
      test(null);
      test('blort');
      test(['blort']);
      test({ x: 'blort' });
    });
  });

  describe('.payload', () => {
    it('should be the value passed to the constructor', () => {
      const payload = new Functor('x', 1, 2, 3);
      const op = new MockOp(payload);

      assert.strictEqual(op.payload, payload);
    });
  });

  describe('equals()', () => {
    it('should return `true` when passed itself', () => {
      const op = new MockOp(new Functor('x', 'y', 'z'));
      assert.isTrue(op.equals(op));
    });

    it('should return `true` when passed an identically-constructed value', () => {
      function test(...args) {
        const op1 = new MockOp(new Functor(...args));
        const op2 = new MockOp(new Functor(...args));
        assert.isTrue(op1.equals(op2));
      }

      test('x');
      test('foo', 1);
      test('bar', ['x']);
      test('baz', { a: 10, b: 20 });
    });

    it('should return `false` when payloads differ', () => {
      function test(p1, p2) {
        const op1 = new MockOp(new Functor(...p1));
        const op2 = new MockOp(new Functor(...p2));
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
      const op = new MockOp(new Functor('x'));

      assert.isFalse(op.equals(undefined));
      assert.isFalse(op.equals(null));
      assert.isFalse(op.equals('not an op'));
      assert.isFalse(op.equals(['also', 'not', 'an', 'op']));
      assert.isFalse(op.equals({ not: 'an op' }));
    });
  });
});
