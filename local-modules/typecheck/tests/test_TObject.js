// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TObject } from 'typecheck';

describe('typecheck/TObject', () => {
  describe('#check(value)', () => {
    it('should return the provided value when passed an object', () => {
      const value = { a: 1, b: 2 };

      assert.strictEqual(TObject.check(value), value);
    });

    it('should throw an Error when passed anything other than an object', () => {
      assert.throws(() => TObject.check('this better not work'));
      assert.throws(() => TObject.check(54));
      assert.throws(() => TObject.check(true));
      assert.throws(() => TObject.check(() => true));
      assert.throws(() => TObject.check(undefined));
    });
  });

  describe('#withExactKeys(value, keys)', () => {
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
