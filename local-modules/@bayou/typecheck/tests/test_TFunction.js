// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';
import { inspect } from 'util';

import { TFunction } from '@bayou/typecheck';

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

describe('@bayou/typecheck/TFunction', () => {
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
    it('accepts a `null` ancestor', () => {
      function test(value) {
        assert.strictEqual(TFunction.checkClass(value, null), value);
      }

      for (const v of [...CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('accepts a value that is the same as the given `ancestor`', () => {
      class Blort { }

      assert.strictEqual(TFunction.checkClass(Map, Map), Map);
      assert.strictEqual(TFunction.checkClass(Blort, Blort), Blort);
    });

    it('accepts a value that is a subclass of the given `ancestor`', () => {
      class Blort { }
      class SubBlort extends Blort { }
      class UltraBlort extends SubBlort { }

      assert.strictEqual(TFunction.checkClass(Map, Object), Map);
      assert.strictEqual(TFunction.checkClass(Blort, Object), Blort);
      assert.strictEqual(TFunction.checkClass(SubBlort, Blort), SubBlort);
      assert.strictEqual(TFunction.checkClass(UltraBlort, Blort), UltraBlort);
    });

    it('rejects a class that is not the same as or a subclass of the given `ancestor`', () => {
      function test(value, ancestor) {
        assert.throws(() => { TFunction.checkClass(value, ancestor); });
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
      function test(ancestor) {
        assert.throws(() => { TFunction.checkClass(Object, ancestor); },
          /./, /./, inspect(ancestor));
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
    it('returns `true` when passed a callable function', () => {
      function test(value) {
        assert.isTrue(TFunction.isCallable(value), value);
      }

      for (const v of [...NON_CLASS_FUNCTIONS, ...AMBIGUOUS_FUNCTIONS]) {
        test(v);
      }
    });

    it('returns `false` when passed a non-callable function', () => {
      function test(value) {
        assert.isFalse(TFunction.isCallable(value), value);
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('returns `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TFunction.isCallable(value), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('isClass(value)', () => {
    it('returns `true` when passed a class', () => {
      function test(value) {
        assert.isTrue(TFunction.isClass(value), value);
      }

      for (const v of CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('returns `false` when passed a non-class function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value), value);
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('returns `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('isClass(value, ancestor)', () => {
    it('accepts a `null` ancestor', () => {
      assert.isTrue(TFunction.isClass(Map, null));
      assert.isFalse(TFunction.isClass(123, null));
    });

    it('returns `true` for a value that is the same as the given `ancestor`', () => {
      class Blort { }

      assert.isTrue(TFunction.isClass(Map, Map));
      assert.isTrue(TFunction.isClass(Blort, Blort));
    });

    it('returns `true` for a value that is a subclass of the given `ancestor`', () => {
      class Blort { }
      class SubBlort extends Blort { }
      class UltraBlort extends SubBlort { }

      assert.isTrue(TFunction.isClass(Map, Object));
      assert.isTrue(TFunction.isClass(Blort, Object));
      assert.isTrue(TFunction.isClass(SubBlort, Blort));
      assert.isTrue(TFunction.isClass(UltraBlort, Blort));
    });

    it('returns `false` when passed a class that is not the same as `ancestor` nor is a subclass of it', () => {
      function test(value, ancestor) {
        assert.isFalse(TFunction.isClass(value, ancestor));
      }

      class Blort { }
      class SubBlort extends Blort { }

      test(Map, Set);
      test(Object, Map);
      test(Object, Blort);
      test(Object, SubBlort);
      test(Blort, SubBlort);
    });

    it('returns `false` when passed a non-class function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value, Object), value);
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('returns `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TFunction.isClass(value, Object), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-class for `ancestor`', () => {
      function test(ancestor) {
        assert.throws(() => { TFunction.isClass(Object, ancestor); },
          /./, /./, inspect(ancestor));
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
});
