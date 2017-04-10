// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ProductInfo } from 'server-env';
import { TObject } from 'typecheck';

// see comment below for why this is commented out
//import { PidFile } from 'server-env';

describe('server-env.ProductInfo', () => {
  describe('.INFO', () => {
    it('should return an object full of product info', () => {
      const info = ProductInfo.INFO;

      // TODO: this list of keys is currently an amalgam of those from bayou/script/build
      // and bayou-overlay/product-info.txt. Ugh. Not good. This should probably be
      // broken out into two separate tests so that each environment's expected contributions
      // can be tested independently.
      const productKeys = ['name', 'version', 'commit-id', 'commit-date'];

      assert.doesNotThrow(() => TObject.withExactKeys(info, productKeys));
    });
  });
});
