// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { Singleton } from '@bayou/util-common';

describe('@bayou/util-common/Singleton', () => {
  describe('.theOne', () => {
    it('should return the same object every time it is called', () => {
      class TestClass extends Singleton { /*empty*/ }
      const test1 = TestClass.theOne;
      const test2 = TestClass.theOne;

      assert.strictEqual(test1, test2);
    });

    it('should allow manual construction if it has not ever been constructed', () => {
      class TestClass extends Singleton { /*empty*/ }

      const test1 = new TestClass();
      const test2 = TestClass.theOne;

      assert.strictEqual(test1, test2);
    });

    it('should throw an error if the constructor is called after the singleton is created', () => {
      class TestClass extends Singleton { /*empty*/ }

      assert.isNotNull(TestClass.theOne);
      assert.throws(() => new TestClass());
    });
  });
});
