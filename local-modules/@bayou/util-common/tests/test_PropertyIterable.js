// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
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

describe('@bayou/util-common/PropertyIterable', () => {
  describe('iterating over all properties', () => {
    it('should return all properties of the object', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const expectedProperties = ['a', 'b', 'functionItem', 'classItem', 'objectItem'];

      testIteratable(iter, expectedProperties);
    });
  });

  describe('onlyMethods()', () => {
    it('should return just callable function elements of the object', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const methodIter = iter.onlyMethods();
      const expectedProperties = ['functionItem'];
      const unexpectedProperties = ['a', 'b', 'classItem', 'objectItem'];

      testIteratable(methodIter, expectedProperties, unexpectedProperties);
    });
  });

  describe('skipObject()', () => {
    it('should return just properties that are not part of Object', () => {
      const iter = new PropertyIterable(TEST_OBJECT);
      const nonObjectIter = iter.skipObject();
      const expectedProperties = ['a', 'b', 'objectItem', 'functionItem', 'classItem'];

      const result = testIteratable(nonObjectIter, expectedProperties);

      assert.hasAllKeys(result, expectedProperties);
    });
  });

  describe('skipSynthetic()', () => {
    it('should iterate solely over non-synthetic properties', () => {
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

  describe('skipMethods()', () => {
    it('should iterate solely over non-methods', () => {
      const obj = {
        yes1: 'x',
        yes2: 'y',
        get yes3() { return 10; },
        no1() { /*empty*/ },
        no2: () => { /*empty*/ }
      };
      const iter = new PropertyIterable(obj).skipMethods();
      const expectedProperties = ['yes1', 'yes2', 'yes3'];

      testIteratable(iter, expectedProperties);
    });
  });

  describe('skipPrivate()', () => {
    it('should omit private properties', () => {
      const obj = {
        yes1: 'x',
        yes2() { /*empty*/ },
        get yes3() { return 10; },
        _: 'no',
        _no2: 'no',
        get _no3() { return 10; }
      };
      const iter = new PropertyIterable(obj).skipPrivate();
      const expectedProperties = ['yes1', 'yes2', 'yes3'];

      testIteratable(iter, expectedProperties);
    });
  });
});

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
