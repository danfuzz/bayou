// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Singleton } from 'util-common';

class TestClass extends Singleton {
  /* nothing new here */
}

describe('util-common/Singleton', () => {
  describe('theOne()', () => {
    it('should return the same object every time it is called', () => {
      const test1 = TestClass.theOne;
      const test2 = TestClass.theOne;

      assert.isTrue(test1 === test2);
    });

    it('should throw an Error if the constructor is called after the singleton is created', () => {
      const test_unused = TestClass.theOne;

      assert.throws(() => new TestClass());
    });
  });
});
