// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TClass } from 'typecheck';

// ESLint gets confused by all the inline function definitions.
/* eslint-disable valid-jsdoc */

/**
 * Top-level class, for `CLASS_CASES`, with a method for `NON_CLASS_FUNCTIONS`.
 */
class SomeClass {
  florp() { return 1; }
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

/** {array<class>} Things that should be considered classes. */
const CLASS_CASES = [
  class { x() { return 1; } },
  function () { return 1; },
  function florp() { return 1; },
  SomeClass,
  someFunc
];

/** {array<function>} Functions that should _not_ be considered classes. */
const NON_CLASS_FUNCTIONS = [
  () => { return 1; },
  SomeClass.florp, // Methods of classes are not themselves classes.
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
  914,
  ['x'],
  { 'a': 10 }
];

describe('typecheck/TClass', () => {
  describe('check()', () => {
    it('should succeed when passed a class', () => {
      function test(value) {
        assert.strictEqual(TClass.check(value), value);
      }

      for (const v of CLASS_CASES) {
        test(v);
      }
    });

    it('should fail when passed a non-class function', () => {
      function test(value) {
        assert.throws(() => { TClass.check(value); });
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should fail when passed a non-function', () => {
      function test(value) {
        assert.throws(() => { TClass.check(value); });
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });

  describe('isInstance()', () => {
    it('should return `true` when passed a class', () => {
      function test(value) {
        assert.isTrue(TClass.isInstance(value), value);
      }

      for (const v of CLASS_CASES) {
        test(v);
      }
    });

    it('should return `false` when passed a non-class function', () => {
      function test(value) {
        assert.isFalse(TClass.isInstance(value), value);
      }

      for (const v of NON_CLASS_FUNCTIONS) {
        test(v);
      }
    });

    it('should return `false` when passed a non-function', () => {
      function test(value) {
        assert.isFalse(TClass.isInstance(value), value);
      }

      for (const v of NON_FUNCTIONS) {
        test(v);
      }
    });
  });
});
