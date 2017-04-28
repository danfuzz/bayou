// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TFunction } from 'typecheck';

describe('typecheck/TFunction', () => {
  describe('#check(function)', () => {
    it('should return the provided value when passed a function', () => {
      const sampleFunction = function () { let a = false; if (a) a ^= 1; };

      assert.strictEqual(TFunction.check(sampleFunction), sampleFunction);
    });

    it('should throw an Error when passed anything other than a function', () => {
      assert.throws(() => TFunction.check('this better not work'));
      assert.throws(() => TFunction.check([]));
      assert.throws(() => TFunction.check({ }));
      assert.throws(() => TFunction.check(54));
      assert.throws(() => TFunction.check(true));
      assert.throws(() => TFunction.check(undefined));
    });
  });
});
