// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { Functor } from 'util-core';

describe('util-core/Functor', () => {
  describe('constructor()', () => {
    it('should accept valid names', () => {
      function test(name) {
        const result = new Functor(name);
        assert.instanceOf(result, Functor, name);
      }

      test('a');
      test('A');
      test('_');
      test('a1');
      test('_0123456789');
      test('abcde_fghij_klmno_pqrst_uvwxy_z');
      test('ABCDE_FGHIJ_KLMNO_PQRST_UVWXY_Z');
    });

    it('should accept various amounts and types of arguments', () => {
      function test(...args) {
        const result = new Functor('blort', ...args);
        assert.instanceOf(result, Functor, inspect(args));
      }

      test();
      test(1);
      test('a', true, null, undefined);
      test(new Functor('x', 11, 22));
      test(new Boolean(true));
      test(new Map());
      test([[[[[[[10]]]]]]], { a: { b: { c: 20 } } });
      test(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20);
    });

    it('should reject invalid names', () => {
      function test(name) {
        assert.throws(() => { new Functor(name); });
      }

      test('');
      test('1');
      test('x%');
      test(123);
      test(null);
    });
  });

  describe('.args', () => {
    it('should be a frozen array', () => {
      const ftor = new Functor('blort', 'a', ['b'], { c: 30 });
      assert.isArray(ftor.args);
      assert.isFrozen(ftor.args);
    });

    it('should report the constructed args', () => {
      function test(...args) {
        const result = new Functor('blort', ...args);
        const resultArgs = result.args;

        assert.strictEqual(resultArgs.length, args.length);
        for (let i = 0; i < args.length; i++) {
          assert.strictEqual(resultArgs[i], args[i], inspect(args[i]));
        }
      }

      test();
      test(1, 2, 3);
      test([[[['a']]]], new Map(), new Set());
    });
  });

  describe('.name', () => {
    it('should report the constructed name', () => {
      function test(name) {
        const result = new Functor(name);
        assert.strictEqual(result.name, name);
      }

      test('blort');
      test('florp_like');
      test('SIDEWAYS_TIMELINE');
    });
  });

  describe('equals()', () => {
    it('should return `true` when compared to itself', () => {
      const ftor = new Functor('blort', 10);
      assert.isTrue(ftor.equals(ftor));
    });

    it('should return `true` when compared to a samely-constructed instance', () => {
      const arrayArg = ['a', 'b'];
      const ftor1 = new Functor('blort', 10, arrayArg);
      const ftor2 = new Functor('blort', 10, arrayArg);
      assert.isTrue(ftor1.equals(ftor2));
    });

    it('should return `false` when the names do not match', () => {
      const ftor1 = new Functor('blort', 10);
      const ftor2 = new Functor('florp', 10);
      assert.isFalse(ftor1.equals(ftor2));
    });

    it('should return `false` when argument counts do not match', () => {
      const ftor1 = new Functor('blort', 10);
      const ftor2 = new Functor('blort', 10, 20);
      assert.isFalse(ftor1.equals(ftor2));
      assert.isFalse(ftor2.equals(ftor1));
    });

    it('should return `false` when an argument is not strict-equal', () => {
      const ftor1 = new Functor('blort', 10, ['a']);
      const ftor2 = new Functor('blort', 10, ['a']);
      assert.isFalse(ftor1.equals(ftor2));
    });

    it('should return `false` when compared to a non-functor', () => {
      const ftor = new Functor('blort', 10);

      function test(value) {
        assert.isFalse(ftor.equals(value), inspect(value));
      }

      test(undefined);
      test(null);
      test('blort');
      test(['blort', 10]);
      test({ blort: 10 });
    });
  });

  describe('toString()', () => {
    it('should produce expected strings in various cases', () => {
      function test(expect, name, ...args) {
        const result = new Functor(name, ...args);
        assert.strictEqual(result.toString(), expect);
      }

      test('blort()',               'blort');
      test('blort(1)',              'blort', 1);
      test('florp(1, \'foo\')',     'florp', 1, 'foo');
      test('florp([ 1, \'foo\' ])', 'florp', [1, 'foo']);
    });
  });
});
