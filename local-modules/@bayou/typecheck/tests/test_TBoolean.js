// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TBoolean } from '@bayou/typecheck';

describe('@bayou/typecheck/TBoolean', () => {
  describe('check()', () => {
    it('returns the provided value when passed a boolean', () => {
      assert.strictEqual(TBoolean.check(true), true);
      assert.strictEqual(TBoolean.check(false), false);
    });

    it('throws an Error when passed undefined', () => {
      assert.throws(() => TBoolean.check(undefined));
    });

    it('throws an Error when passed anything other than a boolean', () => {
      assert.throws(() => TBoolean.check('this better not work'));
      assert.throws(() => TBoolean.check([]));
      assert.throws(() => TBoolean.check({ }));
      assert.throws(() => TBoolean.check(54));
    });
  });
});
