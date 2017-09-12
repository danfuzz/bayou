// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

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
  someFunc
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

  describe('checkClass()', () => {
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
