// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TArray } from 'typecheck';
import { TInt } from 'typecheck';
import { TString } from 'typecheck';

describe('typecheck.TArray', () => {
  describe('#check(value)', () => {
    it('should return the provided value when passed an array', () => {
      const value = [1, 2, 3];

      assert.doesNotThrow(() => TArray.check(value));
      assert.strictEqual(TArray.check(value), value);
    });

    it('should throw an Error when passed anything other than an array', () => {
      assert.throws(() => TArray.check(3.1));
      assert.throws(() => TArray.check({ }));
      assert.throws(() => TArray.check('this better not work'));
    });
  });

  describe('#check(value, elementChecker)', () => {
    it('should validate array elements with an element checker', () => {
      const value = [1, 2, 3];

      assert.doesNotThrow(() => TArray.check(value, TInt.check));
    });

    it('should throw an error if an element checker fails', () => {
      const value = [1, 2, 3];

      assert.throws(() => TArray.check(value, TString.check));
    });
  });
});
