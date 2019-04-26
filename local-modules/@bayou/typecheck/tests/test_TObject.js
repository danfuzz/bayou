// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TObject } from '@bayou/typecheck';

describe('@bayou/typecheck/TObject', () => {
  describe('check(value)', () => {
    it('returns the provided value when passed an object', () => {
      function test(value) {
        assert.strictEqual(TObject.check(value), value);
      }

      test({ a: 1, b: 2 });
      test([1, 2, 3]);
      test(() => 123);
      test(new Map());
    });

    it('throws an Error when passed anything other than an object', () => {
      assert.throws(() => TObject.check(null));
      assert.throws(() => TObject.check(undefined));
      assert.throws(() => TObject.check(54));
      assert.throws(() => TObject.check(true));
      assert.throws(() => TObject.check('this better not work'));
    });
  });

  describe('check(value, clazz)', () => {
    it('should accept a value of the given class', () => {
      function test(value, clazz) {
        assert.strictEqual(TObject.check(value, clazz), value);
      }

      test({ a: 10 }, Object);

      test(['x'],     Array);
      test(['x'],     Object);

      test(() => 123, Function);
      test(() => 123, Object);
    });

    it('throws an Error when passed a value not of the given class', () => {
      assert.throws(() => TObject.check(new Boolean(true), String));
    });

    it('throws an Error when passed anything other than an object', () => {
      assert.throws(() => TObject.check(null, Object));
      assert.throws(() => TObject.check(54,   Object));
    });
  });

  describe('orNull(value)', () => {
    it('returns the provided value when passed an object', () => {
      function test(value) {
        assert.strictEqual(TObject.orNull(value), value);
      }

      test({ a: 1, b: 2 });
      test([1, 2, 3]);
      test(() => 123);
      test(new Map());
    });

    it('returns `null` when passed `null`', () => {
      assert.isNull(TObject.orNull(null));
    });

    it('throws an Error when passed anything other than an object or `null`', () => {
      assert.throws(() => TObject.orNull(undefined));
      assert.throws(() => TObject.orNull(false));
      assert.throws(() => TObject.orNull(54));
      assert.throws(() => TObject.orNull('this better not work'));
    });
  });

  describe('orNull(value, clazz)', () => {
    it('returns the provided value when passed an object of a matching class', () => {
      function test(value, clazz) {
        assert.strictEqual(TObject.orNull(value, clazz), value);
      }

      test({ a: 1, b: 2 }, Object);
      test([1, 2, 3],      Array);
      test([1, 2, 3],      Object);
      test(() => 123,      Function);
      test(new Map(),      Map);
      test(new Map(),      Object);
    });

    it('returns `null` when passed a `null` value, no matter what class is passed', () => {
      assert.isNull(TObject.orNull(null, Object));
      assert.isNull(TObject.orNull(null, Set));
    });

    it('throws an Error when passed an object of a non-matching class', () => {
      assert.throws(() => TObject.orNull(new Map(), Set));
      assert.throws(() => TObject.orNull(new Set(), Map));
    });

    it('throws an Error when passed anything other than an object or `null`', () => {
      assert.throws(() => TObject.orNull(false,   Boolean));
      assert.throws(() => TObject.orNull(914,     Number));
      assert.throws(() => TObject.orNull('florp', String));
    });
  });

  describe('plain()', () => {
    it('should accept plain objects', () => {
      function test(value) {
        assert.strictEqual(TObject.plain(value), value);
      }

      test({});
      test({ a: 10 });
      test({ a: 10, b: 20 });
    });

    it('should reject non-plain objects', () => {
      function test(value) {
        assert.throws(() => { TObject.plain(value); });
      }

      test([]);
      test([1]);
      test(() => true);
      test(new Map());
      test({ get x() { return 'x'; } });
      test({ set x(v) { /*empty*/ } });
      test({ [Symbol('blort')]: [1, 2, 3] });
    });

    it('should reject non-objects', () => {
      function test(value) {
        assert.throws(() => { TObject.plain(value); });
      }

      test(null);
      test(undefined);
      test(false);
      test(true);
      test('x');
      test(37);
    });
  });

  describe('withExactKeys()', () => {
    it('should accept an empty list of keys', () => {
      const value = {};

      assert.strictEqual(TObject.withExactKeys(value, []), value);
    });

    it('should accept an object with exactly the provided keys', () => {
      const value = { 'a': 1, 'b': 2, 'c': 3 };

      assert.strictEqual(TObject.withExactKeys(value, ['a', 'b', 'c']), value);
    });

    it('should reject an object value which is missing a key', () => {
      const value = { 'a': 1, 'b': 2 };

      assert.throws(() => TObject.withExactKeys(value, ['a', 'b', 'c']));
    });

    it('should reject an object with a superset of keys', () => {
      const value = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

      assert.throws(() => TObject.withExactKeys(value, ['a', 'b', 'c']));
    });

    it('should reject non-plain objects', () => {
      assert.throws(() => TObject.withExactKeys(new Map(),  []));
      assert.throws(() => TObject.withExactKeys(['z'],      []));
      assert.throws(() => TObject.withExactKeys(() => true, []));
    });

    it('should reject non-objects', () => {
      assert.throws(() => TObject.withExactKeys('x',  []));
      assert.throws(() => TObject.withExactKeys(914,  []));
      assert.throws(() => TObject.withExactKeys(null, []));
    });
  });
});
