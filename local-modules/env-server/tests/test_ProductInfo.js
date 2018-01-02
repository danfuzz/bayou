// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ProductInfo } from 'env-server';
import { TObject } from 'typecheck';

describe('env-server/ProductInfo', () => {
  describe('.INFO', () => {
    it('should return an object full of product info', () => {
      const info = ProductInfo.theOne.INFO;

      // TODO: This list of keys is currently an amalgam of those from Bayou
      // and those from a privately-used overlay. Ugh. Not good. This should
      // probably be broken out into two separate tests so that each
      // environment's expected contributions can be tested independently.
      const productKeys = ['name', 'version', 'commit_id', 'commit_date'];

      assert.doesNotThrow(() => TObject.withExactKeys(info, productKeys));
    });
  });
});
