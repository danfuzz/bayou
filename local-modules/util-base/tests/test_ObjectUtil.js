// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { ObjectUtil } from 'util-base';

describe('util-base/ObjectUtil', () => {
  describe('#hasOwnProperty(value, name)', () => {
    it('should return true when asked about an object\'s own propery', () => {
      const value = {};

      value.uniqueProperty = 'super neat!';

      assert.isTrue(ObjectUtil.hasOwnProperty(value, 'uniqueProperty'));
    });

    it('should return false when asked about a property in a parent', () => {
      const value = {};

      assert.isFalse(ObjectUtil.hasOwnProperty(value, 'toString'));
    });

    it('should return false when asked about an absent property', () => {
      const value = 'this is a neat string!';

      assert.isFalse(ObjectUtil.hasOwnProperty(value, 'floopty'));
    });
  });
});
