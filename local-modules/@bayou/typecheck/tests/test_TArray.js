// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TArray } from '@bayou/typecheck';
import { TInt } from '@bayou/typecheck';
import { TString } from '@bayou/typecheck';

describe('@bayou/typecheck/TArray', () => {
  describe('check(value)', () => {
    it('returns the provided value when passed an array', () => {
      const value = [1, 2, 3];

      assert.doesNotThrow(() => TArray.check(value));
      assert.strictEqual(TArray.check(value), value);
    });

    it('throws an Error when passed anything other than an array', () => {
      assert.throws(() => TArray.check(3.1));
      assert.throws(() => TArray.check({ }));
      assert.throws(() => TArray.check('this better not work'));
    });
  });

  describe('check(value, elementChecker)', () => {
    it('validates array elements with an element checker', () => {
      const value = [1, 2, 3];

      assert.doesNotThrow(() => TArray.check(value, x => TInt.check(x)));
    });

    it('throws an error if an element checker fails', () => {
      const value = [1, 2, 3];

      assert.throws(() => TArray.check(value, x => TString.check(x)));
    });
  });
});
