// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { DataUtil, FrozenBuffer, Functor } from '@bayou/util-core';

describe('@bayou/util-core/DataUtil', () => {
  describe('deepFreeze()', () => {
    // Tests that should work the same for both `null` and non-`null` values for
    // `nonDataConverter`.
    function commonTests(nonDataConverter) {
      it('returns the given value if it is a primitive', () => {
        function test(value) {
          const popsicle = DataUtil.deepFreeze(value, nonDataConverter);
          assert.strictEqual(popsicle, value);
        }

        test(undefined);
        test(null);
        test(false);
        test(true);
        test(37);
        test('a string');
        test(Symbol('foo'));
      });

      it('returns the provided value if it is already deep-frozen', () => {
        function test(value) {
          const popsicle     = DataUtil.deepFreeze(value, nonDataConverter);
          const deepPopsicle = DataUtil.deepFreeze(popsicle, nonDataConverter);
          assert.isTrue(DataUtil.isDeepFrozen(popsicle));
          assert.strictEqual(deepPopsicle, popsicle, 'Frozen strict-equals re-frozen.');
          assert.deepEqual(deepPopsicle, value, 'Re-frozen deep-equals original.');
        }

        test({});
        test({ a: 1 });
        test({ a: { b: 10 }, c: { d: 20 } });
        test([]);
        test([1]);
        test([[1, 2], [3, 4]]);
      });

      it('returns a deep-frozen object if passed one that isn\'t already deep-frozen', () => {
        function test(value) {
          const popsicle = DataUtil.deepFreeze(value, nonDataConverter);
          assert.isTrue(DataUtil.isDeepFrozen(popsicle, nonDataConverter));
          assert.deepEqual(popsicle, value);
        }

        test({});
        test({ a: 1, b: 2 });
        test([]);
        test([1, 2, 'foo', 'bar']);
        test([[[[[[[[[['hello']]]]]]]]]]);
        test({ x: [[[[[123]]]]], y: [37, [37], [[37]], [[[37]]]], z: [{ x: 10 }] });
      });

      it('does not freeze the originally passed value', () => {
        const orig = [1, 2, 3];
        const popsicle = DataUtil.deepFreeze(orig, nonDataConverter);

        assert.isTrue(DataUtil.isDeepFrozen(popsicle));
        assert.isNotFrozen(orig);
      });

      it('works on arrays with holes', () => {
        const orig = [1, 2, 3];
        orig[37]   = ['florp'];
        orig[914]  = [[['like']]];

        const popsicle = DataUtil.deepFreeze(orig, nonDataConverter);

        assert.isTrue(DataUtil.isDeepFrozen(popsicle));
        assert.deepEqual(popsicle, orig);
      });

      it('works on arrays with additional string-named properties', () => {
        const orig = [1, 2, 3];
        orig.florp = ['florp'];
        orig.like  = [[['like']]];

        const popsicle = DataUtil.deepFreeze(orig, nonDataConverter);

        assert.isTrue(DataUtil.isDeepFrozen(popsicle));
        assert.deepEqual(popsicle, orig);
      });

      it('works on arrays with additional symbol-named properties', () => {
        const orig = [1, 2, 3];
        orig[Symbol('florp')] = ['florp'];
        orig[Symbol('like')] = [[['like']]];

        const popsicle = DataUtil.deepFreeze(orig, nonDataConverter);

        assert.isTrue(DataUtil.isDeepFrozen(popsicle));
        assert.deepEqual(popsicle, orig);
      });

      it('works on objects with symbol-named properties', () => {
        const orig = { a: 10, [Symbol('b')]: 20 };

        const popsicle = DataUtil.deepFreeze(orig, nonDataConverter);

        assert.isTrue(DataUtil.isDeepFrozen(popsicle));
        assert.deepEqual(popsicle, orig);
      });

      it('returns a given `FrozenBuffer`', () => {
        function test(value) {
          assert.strictEqual(DataUtil.deepFreeze(value, nonDataConverter), value);
        }

        test(FrozenBuffer.coerce(''));
        test(FrozenBuffer.coerce('florp'));
      });

      it('works on functors with freezable arguments', () => {
        function test(...args) {
          const ftor = new Functor(...args);
          const popsicle = DataUtil.deepFreeze(ftor, nonDataConverter);
          assert.deepEqual(ftor, popsicle);
          assert.notStrictEqual(ftor, popsicle);
        }

        // All these cases have at least one non-frozen argument, because
        // otherwise the functor would already be deep-frozen. That situation is
        // checked in the next test.
        test('blort', []);
        test('blort', 'foo', ['bar']);
        test('blort', new Functor('x', [1, 2, 3]), [4, 5, 6]);
      });

      it('works on already-deep-frozen functors', () => {
        function test(...args) {
          const ftor = new Functor(...args);
          const popsicle = DataUtil.deepFreeze(ftor, nonDataConverter);
          assert.strictEqual(ftor, popsicle);
        }

        test('blort');
        test('blort', 1);
        test('blort', 'foo', Object.freeze(['bar']));
        test('blort', new Functor('x', 1, 2, 3), 'four');
      });
    }

    describe('with `nonDataConverter === null`', () => {
      commonTests(null);

      it('fails if given a function or a composite that contains same', () => {
        function test(value) {
          assert.throws(() => { DataUtil.deepFreeze(value); });
        }

        test(test); // Because `test` is indeed a function!
        test(() => 123);
        test([1, 2, 3, test]);
        test([1, 2, 3, [[[[[test]]]]]]);
        test({ a: 10, b: test });
        test({ a: 10, b: { c: { d: test } } });
      });

      it('fails if given a non-plain object or a composite that contains same', () => {
        function test(value) {
          assert.throws(() => { DataUtil.deepFreeze(value); });
        }

        const instance = new Number(10);
        const synthetic = {
          a: 10,
          get x() { return 20; }
        };

        test(instance);
        test(synthetic);
        test([instance]);
        test([1, 2, 3, [[[[[synthetic]]]]]]);
        test({ a: 10, b: instance });
        test({ a: 10, b: { c: { d: synthetic } } });
      });
    });

    describe('with `nonDataConverter !== null`', () => {
      commonTests(inspect);

      it('converts a non-plain object via the converter function', () => {
        class Florp {
          inspect() {
            return '{florp}';
          }
        }

        const result = DataUtil.deepFreeze(new Florp(), inspect);

        assert.strictEqual(result, '{florp}');
      });

      it('converts a function via the converter function', () => {
        function someFunc() { return 10; }
        const result = DataUtil.deepFreeze(someFunc, inspect);

        assert.strictEqual(result, '[Function: someFunc]');
      });

      it('converts a plain object with synthetic properties via the converter function', () => {
        const obj = {
          a: 10,
          b: 20,

          c: {
            a: 'a',
            b: 'b',
            get z() { return 1; }
          },

          d: {
            a: 1,
            b: 2,
            set y(value_unused) { /*empty*/ }
          }
        };

        function converter(x) {
          return `${x.a} ${x.b}`;
        }

        const result1 = DataUtil.deepFreeze(obj.c, converter);
        const result2 = DataUtil.deepFreeze(obj.d, converter);
        const result3 = DataUtil.deepFreeze(obj, converter);

        assert.strictEqual(result1, 'a b');
        assert.strictEqual(result2, '1 2');
        assert.deepEqual(result3, { a: 10, b: 20, c: 'a b', d: '1 2' });
      });
    });

    it('uses the converter function recursively', () => {
      const obj = {
        get x() { return null; },
        a: 10,
        b: 20,
        c: {
          a: 'a',
          b: 'b',
          c: 'c',

          get y() { return null; }
        }
      };

      function converter(x) {
        return [`${x.a} ${x.b}`, x.c];
      }

      const result = DataUtil.deepFreeze(obj, converter);

      assert.deepEqual(result, ['10 20', ['a b', 'c']]);
    });
  });

  describe('equalData()', () => {
    it('returns `true` for equal primitive values', () => {
      function test(value) {
        assert.isTrue(DataUtil.equalData(value, value));
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(37);
      test(NaN);
      test(-0);
      test('a string');
      test(Symbol('foo'));
    });

    it('returns `true` for equal-content arrays', () => {
      function test(v1, v2) {
        assert.isTrue(DataUtil.equalData(v1, v2), inspect(v1));
      }

      test([],                   []);
      test([1],                  [1]);
      test(['a', 'b', 'c'],      ['a', 'b', 'c']);
      test([1, [2, 3]],          [1, [2, 3]]);
      test([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }]);

      // Extra properties.
      const v1 = [1, 2, 3]; v1.x = 'x'; v1.y = 'y';
      const v2 = [1, 2, 3]; v2.x = 'x'; v2.y = 'y';
      test(v1, v2);
    });

    it('returns `true` for equal-content objects', () => {
      function test(v1, v2) {
        assert.isTrue(DataUtil.equalData(v1, v2), v1);
      }

      test({}, {});
      test({ a: 1 }, { a: 1 });
      test({ a: 1, b: { b: 2 } }, { a: 1, b: { b: 2 } });
    });

    it('returns `true` for equal-content `FrozenBuffer`s', () => {
      function test(content) {
        const buf1 = FrozenBuffer.coerce(content);
        const buf2 = FrozenBuffer.coerce(content);
        assert.isTrue(DataUtil.equalData(buf1, buf2), buf1);
      }

      test('');
      test('Florps are now likes again.');
    });

    it('returns `true` for equal-content functors', () => {
      function test(v1, v2) {
        assert.isTrue(DataUtil.equalData(v1, v2), v1);
      }

      test(new Functor('x'),           new Functor('x'));
      test(new Functor('y', 1, 2, 3),  new Functor('y', 1, 2, 3));
      test(new Functor('z', [1, [2]]), new Functor('z', [1, [2]]));
    });

    it('returns `false` for non-data objects even if equal', () => {
      function test(value) {
        assert.isFalse(DataUtil.equalData(value, value), value);
      }

      test(() => 10);
      test(new Map());
      test(/blort/);
    });

    it('returns `false` for non-equal values', () => {
      function test(v1, v2) {
        assert.isFalse(DataUtil.equalData(v1, v2), inspect(v1));
      }

      test(null, undefined);
      test(null, false);
      test(null, 0);
      test(null, '');
      test(null, []);
      test(null, {});

      test(undefined, null);
      test(undefined, false);
      test(undefined, 0);
      test(undefined, '');
      test(undefined, []);
      test(undefined, {});

      test(false, undefined);
      test(false, null);
      test(false, 0);
      test(false, '');
      test(false, []);
      test(false, {});

      test(0, undefined);
      test(0, false);
      test(0, null);
      test(0, '');
      test(0, []);
      test(0, {});

      test('', undefined);
      test('', false);
      test('', 0);
      test('', null);
      test('', []);
      test('', {});

      test(1,        '1');
      test(true,     'true');
      test([37],     37);
      test({ x: 1 }, 1);

      test(new Functor('x', 1, 2, 3), [1, 2, 3]);
    });

    it('returns `false` given an object/array with non-data bindings', () => {
      function test(v) {
        const obj = { a: 10, b: v, c: 20 };
        assert.isFalse(DataUtil.equalData(obj, obj), inspect(v));

        const arr = [1, 2, 3, v, 4, 5, 6];
        assert.isFalse(DataUtil.equalData(arr, arr), inspect(v));
      }

      // Direct.
      test(/regex_is_not_data/);
      test(new Map());

      // Nested.
      test([/regex_is_not_data/]);
      test([new Map()]);
      test({ x: /regex_is_not_data/ });
      test({ x: new Map() });
      test([[[[[[[[[[[/regex_is_not_data/]]]]]]]]]]]);
    });
  });

  describe('isData()', () => {
    it('returns `true` for primitive values', () => {
      function test(value) {
        assert.isTrue(DataUtil.isData(value));
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(37);
      test('a string');
      test(Symbol('foo'));
    });

    it('returns `true` for appropriate composites', () => {
      function test(value) {
        assert.isTrue(DataUtil.isData(value));
      }

      test([]);
      test([1, 2, 3]);
      test([[1, 2, 3]]);
      test([FrozenBuffer.coerce('zorch')]);

      test({});
      test({ a: 10, b: 20 });
      test({ a: 10, b: Object.freeze({ c: 30 }) });

      test(new Functor('x'));
      test(new Functor('x', 1));
      test(new Functor('x', [1, 2, 3]));
      test(new Functor('x', new Functor('y', 914, 37)));

      test(FrozenBuffer.coerce('florp'));
    });

    it('returns `false` for non-plain objects or composites with same', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      const instance = new Number(10);
      const synthetic = {
        a: 10,
        get x() { return 20; }
      };

      test(instance);
      test(synthetic);
      test([instance]);
      test([synthetic]);
      test({ a: instance });
      test({ a: synthetic });
      test({ a: { b: instance } });
      test({ a: [1, 2, 3, synthetic] });
      test(new Functor('x', instance));
      test(new Functor('x', [synthetic]));
    });

    it('returns `false` for functions, generators and composites containing same', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      function func() { return 10; }
      function* gen() { yield 10; }

      test(func);
      test(gen);
      test([func]);
      test([gen]);
      test({ a: func });
      test({ a: [1, 2, gen] });
    });
  });

  describe('isDeepFrozen()', () => {
    it('returns `true` for primitive values', () => {
      function test(value) {
        assert.isTrue(DataUtil.isDeepFrozen(value));
      }

      test(undefined);
      test(null);
      test(false);
      test(true);
      test(37);
      test('a string');
      test(Symbol('foo'));
    });

    it('returns `true` for appropriate frozen composites', () => {
      function test(value) {
        assert.isTrue(DataUtil.isDeepFrozen(value));
      }

      test(Object.freeze([]));
      test(Object.freeze([1, 2, 3]));
      test(Object.freeze([Object.freeze([1, 2, 3])]));

      test(Object.freeze({}));
      test(Object.freeze({ a: 10, b: 20 }));
      test(Object.freeze({ a: 10, b: Object.freeze({ c: 30 }) }));

      test(new Functor('x'));
      test(new Functor('x', 1));
      test(new Functor('x', Object.freeze([1, 2, 3])));
      test(new Functor('x', new Functor('y', 914, 37)));
    });

    it('returns `true` for `FrozenBuffer`s', () => {
      function test(value) {
        assert.isTrue(DataUtil.isDeepFrozen(value));
      }

      test(FrozenBuffer.coerce(''));
      test(FrozenBuffer.coerce('blort'));
    });

    it('returns `false` for composites that are not frozen even if all elements are', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      test([]);
      test([1, 2, 3]);
      test([Object.freeze([1, 2, 3])]);

      test({});
      test({ a: 10, b: 20 });
      test({ a: 10, b: Object.freeze({ c: 30 }) });
    });

    it('returns `false` for frozen composites with non-frozen elements', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      test(Object.freeze([[]]));
      test(Object.freeze([Object.freeze([[]])]));

      test(Object.freeze({ a: {} }));
      test(Object.freeze({ a: Object.freeze({ b: {} }) }));

      test(new Functor('x', []));
      test(new Functor('x', 1, 2, 3, []));
      test(new Functor('x', new Functor('y', [])));
    });

    it('returns `false` for non-plain objects or composites with same', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      const instance = Object.freeze(new Number(10));
      const synthetic = Object.freeze({
        a: 10,
        get x() { return 20; }
      });

      test(instance);
      test(synthetic);
      test(Object.freeze([instance]));
      test(Object.freeze([synthetic]));
      test(Object.freeze({ a: instance }));
      test(Object.freeze({ a: synthetic }));
      test(Object.freeze({ a: Object.freeze({ b: instance }) }));
      test(Object.freeze({ a: Object.freeze([1, 2, 3, synthetic]) }));
      test(new Functor('x', instance));
      test(new Functor('x', Object.freeze([synthetic])));
    });

    it('returns `false` for functions, generators and composites containing same', () => {
      function test(value) {
        assert.isFalse(DataUtil.isDeepFrozen(value));
      }

      function func() { return 10; }
      function* gen() { yield 10; }
      Object.freeze(func);
      Object.freeze(gen);

      test(func);
      test(gen);
      test(Object.freeze([func]));
      test(Object.freeze([gen]));
      test(Object.freeze({ a: func }));
      test(Object.freeze({ a: Object.freeze([1, 2, gen]) }));
    });
  });
});
