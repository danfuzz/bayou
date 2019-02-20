// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { PropertyIterable } from '@bayou/util-common';

const TEST_OBJECT = {
  a: 1,
  b: 2,
  functionItem: () => true,
  classItem: PropertyIterable,
  objectItem: { a: 1 }
};

class Top {
  top1() { /*empty*/ }
  top2() { /*empty*/ }
}

class Middle extends Top {
  middle1() { /*empty*/ }
  middle2() { /*empty*/ }
}

class Bottom extends Middle {
  bottom1() { /*empty*/ }
  bottom2() { /*empty*/ }
}

/**
 * Completes one full iteration cycle and gathers info about the results
 * returned by the provided iterator. It then checks to make sure that at least
 * the expected properties were reported, and that any unexpected properties
 * were not. There may be additional properties set in the results beyond what
 * was specifically checked.
 *
 * @param {PropertyIterable} iter The iterator we are testing.
 * @param {array<string>} expectedProperties List of property names. The
 *   iterator must return _at least_ all of the properties in this list.
 * @param {array<string>} [unexpectedProperties = []] List of property names.
 *   The iterator must not return any of the properties in this list.
 * @returns {array<string>} List of property names returned by the iterator.
 */
function testIteratable(iter, expectedProperties, unexpectedProperties = []) {
  const result = {};

  for (const property of iter) {
    result[property.name] = true;
  }

  if (expectedProperties.length !== 0) {
    assert.containsAllKeys(result, expectedProperties);
  }

  if (unexpectedProperties.length !== 0) {
    assert.doesNotHaveAnyKeys(result, unexpectedProperties);
  }

  return result;
}

describe('@bayou/util-common/PropertyIterable', () => {
  describe('iterating over all properties', () => {
    it('returns all properties of the object', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const expectedProperties = ['a', 'b', 'functionItem', 'classItem', 'objectItem'];

      testIteratable(iter, expectedProperties);
    });
  });

  describe('onlyMethods()', () => {
    it('returns just the callable function elements of the object', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const methodIter = iter.onlyMethods();
      const expectedProperties = ['functionItem'];
      const unexpectedProperties = ['a', 'b', 'classItem', 'objectItem'];

      testIteratable(methodIter, expectedProperties, unexpectedProperties);
    });
  });

  describe('onlyPublic()', () => {
    it('returns just the public properties of the object', () => {
      const sym1 = Symbol('x123');
      const sym2 = Symbol('x234');
      class Blort {
        [sym1]() { /*empty*/ }
        constructor() { /*empty*/ }
        foo() { /*empty*/ }
        _bar() { /*empty*/ }
        get blort() { return 10; }
      }

      Blort.prototype.x = 123;

      const instance = new Blort();
      instance.y     = 123;
      instance.baz   = () => { /*empty*/ };
      instance[sym2] = 123;

      const iter = new PropertyIterable(instance);
      const methodIter = iter.onlyPublic();
      const expectedProperties = ['foo', 'baz', 'blort', 'x', 'y'];
      const unexpectedProperties = ['constructor', '_bar', sym1, sym2];

      testIteratable(methodIter, expectedProperties, unexpectedProperties);
    });
  });

  describe('onlyPublicMethods()', () => {
    it('returns just the public methods of the object', () => {
      const sym1 = Symbol('x123');
      const sym2 = Symbol('x234');
      class Blort {
        [sym1]() { /*empty*/ }
        constructor() { /*empty*/ }
        foo() { /*empty*/ }
        _bar() { /*empty*/ }
        get blort() { return () => 10; } // Not a method because it's a synthetic property.
      }

      Blort.prototype.x = 123;

      const instance = new Blort();
      instance.y     = 123;
      instance.baz   = () => { /*empty*/ };
      instance[sym2] = () => { /*empty*/ };

      const iter = new PropertyIterable(instance);
      const methodIter = iter.onlyPublicMethods();
      const expectedProperties = ['foo', 'baz'];
      const unexpectedProperties = ['constructor', '_bar', 'blort', 'x', 'y', sym1, sym2];

      testIteratable(methodIter, expectedProperties, unexpectedProperties);
    });
  });

  describe('onlyNames()', () => {
    it('omits symbol names', () => {
      const sym1 = Symbol('a');
      const sym2 = Symbol('b');
      const obj = {
        [sym1]: 'x',
        [sym2]() { /*empty*/ },
        c() { return 10; },
        d: 'yes'
      };
      const iter = new PropertyIterable(obj).onlyNames();
      const expectedProperties = ['c', 'd'];
      const unexpectedProperties = [sym1, sym2];

      testIteratable(iter, expectedProperties, unexpectedProperties);
    });
  });

  describe('onlyNames(regex)', () => {
    it('omits symbol names and names that do not match `regex`', () => {
      const sym1 = Symbol('abc_x_abc');
      const sym2 = Symbol('zxy');
      const obj = {
        a: 'no',
        [sym1]: 'no',
        [sym2]() { /*empty*/ },
        x1() { return 10; },
        x2: 123,
        zxv: 456,
        b: 'no',
        c: 'no'
      };
      const iter = new PropertyIterable(obj).onlyNames(/x/);
      const expectedProperties = ['x1', 'x2', 'zxv'];
      const unexpectedProperties = [sym1, sym2, 'a', 'b', 'c'];

      testIteratable(iter, expectedProperties, unexpectedProperties);
    });
  });

  describe('skipClass()', () => {
    it('returns just properties that are "below" the given class', () => {
      const instance = new Bottom();
      instance.x = 1;
      instance.y = 2;

      const iter = new PropertyIterable(instance).skipClass(Middle);
      const expectedProperties = ['constructor', 'x', 'y', 'bottom1', 'bottom2'];

      const result = testIteratable(iter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });
  });

  describe('skipObject()', () => {
    it('returns just properties of a plain object that are not part of `Object`', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const nonObjectIter = iter.skipObject();
      const expectedProperties = ['a', 'b', 'objectItem', 'functionItem', 'classItem'];

      const result = testIteratable(nonObjectIter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });

    it('returns properties of an instance and its class hierarchy except for `Object`', () => {
      const instance = new Bottom();
      instance.aaa = 1;
      instance.bbb = 2;

      const iter = new PropertyIterable(instance).skipObject();
      const expectedProperties = [
        'constructor', 'aaa', 'bbb', 'bottom1', 'bottom2', 'middle1', 'middle2', 'top1', 'top2'];

      const result = testIteratable(iter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });
  });

  describe('skipMethods()', () => {
    it('iterates solely over non-methods', () => {
      const obj = {
        yes1: 'x',
        yes2: 'y',
        get yes3() { return 10; },
        no1() { /*empty*/ },
        no2: () => { /*empty*/ }
      };
      const iter = new PropertyIterable(obj).skipMethods();
      const expectedProperties = ['yes1', 'yes2', 'yes3'];

      const result = testIteratable(iter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });
  });

  describe('skipNames()', () => {
    it('omits names that match', () => {
      const obj = {
        foo_no_1: 'x',
        _no_2() { /*empty*/ },
        get x_no_y() { return 10; },
        yes1: 'yes',
        yes2() { /*empty*/ },
        set yes3(value_unused) { /*empty*/ }
      };
      const iter = new PropertyIterable(obj).skipNames(/_no_/);
      const expectedProperties = ['yes1', 'yes2', 'yes3'];
      const unexpectedProperties = ['foo_no_1', '_no_2', 'x_no_y'];

      testIteratable(iter, expectedProperties, unexpectedProperties);
    });

    it('does not touch symbol-named properties', () => {
      const sym1 = Symbol('_no_');
      const sym2 = Symbol('_no_2');
      const obj = {
        [sym1]: 'x',
        [sym2]() { /*empty*/ },
        x_no_y() { return 10; },
        yes: 'yes'
      };
      const iter = new PropertyIterable(obj).skipNames(/_no_/);
      const expectedProperties = [sym1, sym2, 'yes'];
      const unexpectedProperties = ['x_no_y'];

      testIteratable(iter, expectedProperties, unexpectedProperties);
    });
  });

  describe('skipSynthetic()', () => {
    it('iterates solely over non-synthetic properties', () => {
      const obj = {
        yes1: 'x',
        yes2: 'y',
        get no1() { return 10; },
        get no2() { return 20; },
        set no2(x) { /*empty*/ },
        set no3(x) { /*empty*/ }
      };
      const iter = new PropertyIterable(obj).skipSynthetic();
      const expectedProperties = ['yes1', 'yes2'];

      testIteratable(iter, expectedProperties);
    });
  });

  describe('skipTarget()', () => {
    it('returns just properties that are "below" the given target', () => {
      const top = { top1: 1, top2: 2 };
      const middle = Object.create(top);
      middle.middle1 = 1;
      middle.middle2 = 2;
      const bottom = Object.create(middle);
      bottom.bottom1 = 1;
      bottom.bottom2 = 2;

      const iter = new PropertyIterable(bottom).skipTarget(top);
      const expectedProperties = ['middle1', 'middle2', 'bottom1', 'bottom2'];

      const result = testIteratable(iter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });
  });
});
