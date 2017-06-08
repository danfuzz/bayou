// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { TObject } from 'typecheck';
import { PropertyIter } from 'util-common';

const TEST_OBJECT = {
  a: 1,
  b: 2,
  functionItem: assert,
  classItem: PropertyIter,
  objectItem: {}
};

describe('util-common/PropertyIter', () => {
  describe('iterating over all properties', () => {
    it('should return all properties of the object', () => {
      const iter = new PropertyIter(TEST_OBJECT);
      const expectedProperties = ['a', 'b', 'functionItem', 'classItem', 'objectItem'];

      assert.doesNotThrow(() => _testIterator(iter, expectedProperties));
    });
  });

  describe('iterating soley over methods', () => {
    it('should return just function elements of the object', () => {
      const iter = new PropertyIter(TEST_OBJECT);
      const methodIter = iter.onlyMethods();
      const expectedProperties = ['functionItem', 'classItem'];
      const unexpectedProperties = ['a', 'b', 'objectItem'];

      assert.doesNotThrow(() => _testIterator(methodIter, expectedProperties, unexpectedProperties));
    });
  });

  describe('iterating over properties not defined on Object', () => {
    it('should return just properties that are not part of Object', () => {
      const iter = new PropertyIter(TEST_OBJECT);
      const nonObjectIter = iter.skipObject();
      const expectedProperties = ['a', 'b', 'objectItem', 'functionItem', 'classItem'];

      assert.doesNotThrow(() => _testIterator(nonObjectIter, expectedProperties));

      const result = _testIterator(nonObjectIter, expectedProperties);

      TObject.withExactKeys(result, expectedProperties);
    });
  });

  describe('iterating solely over non-synthetic properties', () => {
    it('should iterate solely over non-synthetic properties');
  });
});

/**
 * Completes one full iteration cycle and gathers info about the results
 * returned by the provided iterator. It then checks to make sure that at least
 * the expected properties were reported, and that any unexpected properties
 * were not. There may be additional properties set in the results beyond what
 * was specifically checked.
 *
 * @param {PropertyIter} iter The iterator we are testing.
 * @param {Array<string>|null} [expectedProperties=[]] A list of property
 *   names. The iterator must return _at least_ all of the properties in this
 *   list.
 * @param {Array<string>|null} [unexpectedProperties=[]] A list of property
 *   names. The iterator must not return any of the properties in this list.
 * @returns {Array<string>} An array of property names returned by the iterator.
 */
function _testIterator(iter, expectedProperties = [], unexpectedProperties = []) {
  const result = {};

  for (const property of iter) {
    result[property.name] = true;
  }

  for (const requiredProperty of expectedProperties) {
    assert.isDefined(result[requiredProperty]);
    assert.isTrue(result[requiredProperty]);
  }

  for (const unexpectedProperty of unexpectedProperties) {
    assert.isUndefined(result[unexpectedProperty]);
  }

  return result;
}
