// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ProductInfo } from '@bayou/env-server';
import { TObject } from '@bayou/typecheck';

describe('@bayou/env-server/ProductInfo', () => {
  describe('.INFO', () => {
    it('is a frozen value', () => {
      const info = ProductInfo.theOne.INFO;

      assert.isFrozen(info);
    });

    it('is an object full of the expected product info', () => {
      const info = ProductInfo.theOne.INFO;
      const productKeys = [
        'buildData', 'buildId', 'commitId', 'commitDate', 'name', 'nodeVersion', 'version'
      ];

      assert.doesNotThrow(() => TObject.withExactKeys(info, productKeys));
    });
  });
});
