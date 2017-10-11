// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { TFunction } from 'typecheck';

// ESLint gets confused by all the inline function definitions.
/* eslint-disable valid-jsdoc */

/**
 * Top-level class, for `CLASS_CASES`, with a method for `NON_CLASS_FUNCTIONS`.
 */
class SomeClass {
  static florp() { return 1; }
  like() { return 1; }
}

/**
 * Top-level function, for `CLASS_CASES`.
 */
function someFunc() {
  return 1;
}

/**
 * Top-level generator, for `NON_CLASS_FUNCTIONS`.
 */
function* someGenerator() {
  yield 1;
}

/**
 * {array<function>} Functions that should be treated as both callable and
 * classes.
 */
const AMBIGUOUS_FUNCTIONS = [
  function () { return 1; },
  function florp() { return 1; },
  someFunc,
  Object,
  Map
];

/** {array<function>} Functions that should be considered classes. */
const CLASS_FUNCTIONS = [
  class { x() { return 1; } },
  class Blort { },
  SomeClass
];

/** {array<function>} Functions that should _not_ be considered classes. */
const NON_CLASS_FUNCTIONS = [
  () => { return 1; },
  function* () { yield 1; },
  SomeClass.florp,          // Methods of classes are not themselves classes.
  SomeClass.prototype.like, // Ditto.
  someGenerator
];

/** {array<*>} Things that are not functions at all. */
const NON_FUNCTIONS = [
  undefined,
  null,
  false,
  true,
  'blort',
  /florp/,
  Symbol('foo'),
  914,
  ['x'],
  { 'a': 10 }
];

describe('typecheck/TFunction', () => {
  describe('check()', () => {
    it('should succeed when passed a function', () => {
      function test(value) {
        assert.strictEqual(TFunction.check(value), value);
      }

      for (const v of [...AMBIGUOUS_FUNCTIONS, ...CLASS_FUNCTIONS, ...NON_CLASS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should fail when passed anything other than a function', () => {
      function test(value) {
        assert.throws(() => { TFunction.check(value); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('checkCallable()', () => {
    it('should succeed when passed a callable function', () => {
      function test(value) {
        assert.strictEqual(TFunction.checkCallable(value), value);
      }

      for (const v of [...NON_CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should fail when passed a non-callable function', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkCallable(value); });
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-function', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkCallable(value); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('checkCallableOrNull()', () => {
    it('should succeed when passed a callable function', () => {
      function test(value) {
        assert.strictEqual(TFunction.checkCallableOrNull(value), value);
      }

      for (const v of [...NON_CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should succeed when passed `null`', () => {
      assert.isNull(TFunction.checkCallableOrNull(null));
    });

    it('should fail when passed a non-callable function', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkCallableOrNull(value); });
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-`null` non-function', () => {
      function test(value) {
        if (value === null) {
          return;
        }

        assert.throws(() => { TFunction.checkCallableOrNull(value); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('checkClass(value)', () => {
    it('should succeed when passed a class', () => {
      function test(value) {
        assert.strictEqual(TFunction.checkClass(value), value);
      }

      for (const v of [...CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should fail when passed a non-class function', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkClass(value); });
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-function', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkClass(value); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('checkClass(value, ancestor)', () => {
    it('should accept a `null` ancestor', () => {
      function test(value) {
        assert.strictEqual(TFunction.checkClass(value, null), value);
      }

      for (const v of [...CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should accept a value that is the same as the given `ancestor`', () => {
      class Blort { }

      assert.strictEqual(TFunction.checkClass(Map, Map), Map);
      assert.strictEqual(TFunction.checkClass(Blort, Blort), Blort);
    });

    it('should accept a value that is a subclass of the given `ancestor`', () => {
      class Blort { }
      class SubBlort extends Blort { }
      class UltraBlort extends SubBlort { }

      assert.strictEqual(TFunction.checkClass(Map, Object), Map);
      assert.strictEqual(TFunction.checkClass(Blort, Object), Blort);
      assert.strictEqual(TFunction.checkClass(SubBlort, Blort), SubBlort);
      assert.strictEqual(TFunction.checkClass(UltraBlort, Blort), UltraBlort);
    });

    it('should reject a class that is not the same as or a subclass of the given `ancestor`', () => {
      function test(value, clazz) {
        assert.throws(() => { TFunction.checkClass(value, clazz); });
      }

      class Blort { }
      class SubBlort extends Blort { }

      test(Map, Set);
      test(Object, Map);
      test(Object, Blort);
      test(Object, SubBlort);
      test(Blort, SubBlort);
    });

    it('should fail when passed a non-class function for `value`', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkClass(value, Object); });
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-function for `value`', () => {
      function test(value) {
        assert.throws(() => { TFunction.checkClass(value, Object); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-class for `ancestor`', () => {
      function test(clazz) {
        assert.throws(() => { TFunction.checkClass(Object, clazz); },
          /./, /./, inspect(clazz));
      }

      for (const v of [...NON_CLASS_FUNCTIONS, ...NON_FUNCTIONS]) {
        if ((v === null) || (v === undefined)) {
          // Skip these, because they degenerate to the one-argument case.
          continue;
        }
        test(v);
      }
    });
  });

  describe('isCallable()', () => {
    it('should return `true` when passed a callable function', () => {
      function test(value) {
        assert.isTrue(TFunction.isCallable(value), value);
      }

      for (const v of [...NON_CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('should return `false` when passed a non-callable function', () => {
      function test(value) {
        assert.isFalse(TFunction.isCallable(value), value);
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should return `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TFunction.isCallable(value), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('isClass()', () => {
    it('should return `true` when passed a class', () => {
      function test(value) {
        assert.isTrue(TFunction.isClass(value), value);
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should return `false` when passed a non-class function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value), value);
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should return `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });
});
