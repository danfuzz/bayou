// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { DataUtil, Functor, ObjectUtil } from '@bayou/util-core';

/**
 * Simple class with an `equals()` method.
 */
class HasEquals {
  constructor(x) {
    this.x = x;
  }

  equals(other) {
    return (other instanceof HasEquals) && (other.x === this.x);
  }
}

describe('@bayou/util-core/Functor', () => {
  describe('constructor()', () => {
    it('accepts valid names', () => {
      function test(name) {
        const result = new Functor(name);
        assert.instanceOf(result, Functor, name);
      }

      test('a');
      test('A');
      test('_');
      test('-');
      test('a1');
      test('_0123456789_');
      test('-0123456789-');
      test('abcde_fghij_klmno_pqrst_uvwxy_z');
      test('ABCDE-FGHIJ-KLMNO-PQRST-UVWXY-Z');
    });

    it('accepts various amounts and types of arguments', () => {
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

    it('rejects invalid names', () => {
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
      test('florp-like');
      test('SIDEWAYS_TIMELINE');
    });
  });

  describe('equals()', () => {
    it('returns `true` when compared to itself', () => {
      const ftor = new Functor('blort', 10);
      assert.isTrue(ftor.equals(ftor));
    });

    it('returns `true` when the name and all arguments are `===`', () => {
      function test(...args) {
        const ftor1 = new Functor('blort', ...args);
        const ftor2 = new Functor('blort', ...args);
        assert.isTrue(ftor1.equals(ftor2));
        assert.isTrue(ftor2.equals(ftor1));
      }

      test();
      test(1);
      test('x', true, undefined);
      test([]);
      test([1, 2, 3]);
      test({ a: 10, b: 20 }, 'foo');
      test(/florp/);
      test(new Set(['x', 'y']));
    });

    it('returns `true` when the name is `===` and all arguments are `equalData()`', () => {
      const ftor1 = new Functor('blort', 10, ['x', ['y']], { a: 123 }, new Functor('z'));
      const ftor2 = new Functor('blort', 10, ['x', ['y']], { a: 123 }, new Functor('z'));
      assert.isTrue(ftor1.equals(ftor2));
      assert.isTrue(ftor2.equals(ftor1));
    });

    it('returns `true` when the name is `===` and all arguments are `.equals()`', () => {
      function test(...args) {
        const args1 = args.map(x => new HasEquals(x));
        const args2 = args.map(x => new HasEquals(x));
        const ftor1 = new Functor('blort', ...args1);
        const ftor2 = new Functor('blort', ...args2);
        assert.isTrue(ftor1.equals(ftor2));
        assert.isTrue(ftor2.equals(ftor1));
      }

      test(1);
      test('x', 'y', [123]);
    });

    it('returns `false` when the names do not match', () => {
      const ftor1 = new Functor('blort', 10);
      const ftor2 = new Functor('florp', 10);
      assert.isFalse(ftor1.equals(ftor2));
      assert.isFalse(ftor2.equals(ftor1));
    });

    it('returns `false` when argument counts do not match', () => {
      const ftor1 = new Functor('blort', 10);
      const ftor2 = new Functor('blort', 10, 20);
      assert.isFalse(ftor1.equals(ftor2));
      assert.isFalse(ftor2.equals(ftor1));
    });

    it('returns `false` when an argument is not `===` or `equalData()` or `.equals()`', () => {
      function test(args1, args2) {
        const ftor1 = new Functor('blort', ...args1);
        const ftor2 = new Functor('blort', ...args2);
        assert.isFalse(ftor1.equals(ftor2));
        assert.isFalse(ftor2.equals(ftor1));
      }

      test([1],                          ['x']);
      test([1, 2],                       [1, 2, 3]);
      test([true],                       [new Set([true])]);
      test([1, new Map()],               [1, new HasEquals(123)]);
      test(['x', new HasEquals(321), 3], ['x', new HasEquals(123), 3]);

      // These make sure we aren't trying to call `.equals()` on a non-object.
      const haseq = new HasEquals('foo');
      test([haseq], [null]);
      test([haseq], [undefined]);
      test([haseq], [true]);
      test([haseq], [123]);
      test([haseq], ['blort']);
      test([haseq], [Symbol('x')]);
      test([haseq, 1], [null, 1]);
      test([1, haseq, 1], [1, null, 1]);
    });

    it('returns `false` when compared to a non-functor', () => {
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

  describe('withFrozenArgs()', () => {
    it('returns `this` if the arguments are all already frozen / deep-frozen', () => {
      function test(...args) {
        const func   = new Functor('florp', ...args);
        const result = func.withFrozenArgs();
        assert.strictEqual(result, func);
      }

      test();
      test(1, 2, 3);
      test('a', 'b', 'c');
      test(true, false);
      test(Symbol('x'), Symbol('y'));

      test(Object.freeze([]));
      test(Object.freeze([1, 2, 3]));
      test(Object.freeze(['a']), Object.freeze(['b']));

      test(Object.freeze({}));
      test(Object.freeze({ a: 'florp' }));

      test(Object.freeze([1, 2, 3, Object.freeze([4, 5])]));

      const alreadyFrozenInstance = Object.freeze(new Map());
      test(alreadyFrozenInstance);
    });

    it('should produce an instance with all frozen arguments equal to the original arguments', () => {
      function test(...args) {
        const result = new Functor('florp', ...args).withFrozenArgs();

        for (const a of result.args) {
          assert.isFrozen(a);
          if (ObjectUtil.isPlain(a)) {
            assert.isTrue(DataUtil.isDeepFrozen(a));
          }
        }

        assert.strictEqual(result.args.length, args.length);
        for (let i = 0; i < args.length; i++) {
          assert.deepEqual(result.args[i], args[i]);
        }
      }

      test([]);
      test([1]);
      test([1], [1, 2]);
      test([1], [1, 2], [1, 2, 3]);
      test([[[[[[[[[[['florp']]]]]]]]]]]);

      test({});
      test({ a: 10 });
      test({ a: 10, b: { c: 20 } });
      test({ a: 10, b: { c: 20 }, d: { e: { f: ['yo'] } } });

      const alreadyFrozen = new Map();
      Object.freeze(alreadyFrozen);
      test(1, 2, alreadyFrozen, 4, 5);

      // This makes sure partially-frozen data ends up fully frozen in the
      // result.
      test(Object.freeze([1, 2, [3, 4, 5]]));
      test(Object.freeze({ a: [1, 2, 3], b: [2, 3, 4] }));
    });

    it('rejects non-frozen non-data arguments', () => {
      function test(...args) {
        const func = new Functor('florp', ...args);
        assert.throws(() => func.withFrozenArgs());
      }

      test(new Map());
      test({ x: new Map() });
      test([new Map()]);
      test([1, 2, 3, [[[[[new Map()]]]]]]);
      test({ get x() { return 10; } });

      test(1, new Map());
      test(1, 2, ['x', new Map()]);
    });
  });
});
