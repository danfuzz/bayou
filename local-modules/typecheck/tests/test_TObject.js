// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TObject } from 'typecheck';

describe('typecheck/TObject', () => {
  describe('check(value)', () => {
    it('should return the provided value when passed an object', () => {
      const value = { a: 1, b: 2 };
      const func  = () => 123;

      assert.strictEqual(TObject.check(value), value);
      assert.strictEqual(TObject.check(func),  func);
    });

    it('should throw an Error when passed anything other than an object', () => {
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

    it('should throw an Error when passed a value not of the given class', () => {
      assert.throws(() => TObject.check(new Boolean(true), String));
    });

    it('should throw an Error when passed anything other than an object', () => {
      assert.throws(() => TObject.check(null, Object));
      assert.throws(() => TObject.check(54,   Object));
    });
  });

  describe('withExactKeys()', () => {
    it('should allow an object with exactly the provided keys', () => {
      const value = { 'a': 1, 'b': 2, 'c': 3 };

      assert.doesNotThrow(() => TObject.withExactKeys(value, ['a', 'b', 'c']));
    });

    it('should throw an Error when an object value is missing a key', () => {
      const value = { 'a': 1, 'b': 2 };

      assert.throws(() => TObject.withExactKeys(value, ['a', 'b', 'c']));
    });

    it('should throw an Error when an object has a superset of keys', () => {
      const value = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

      assert.throws(() => TObject.withExactKeys(value, ['a', 'b', 'c']));
    });
  });
});
