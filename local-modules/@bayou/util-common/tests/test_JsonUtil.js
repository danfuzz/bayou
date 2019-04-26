// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';
import { describe, it } from 'mocha';

import { JsonUtil } from '@bayou/util-common';

describe('@bayou/util-common/JsonUtil', () => {
  describe('parseFrozen(jsonString)', () => {
    it('should throw an error if handed anything other than a string', () => {
      assert.throws(() => JsonUtil.parseFrozen([]));
      assert.throws(() => JsonUtil.parseFrozen({}));
      assert.throws(() => JsonUtil.parseFrozen(Symbol('in a row?')));
    });

    it('should throw an Error when pass a string that isn\'t valid JSON', () => {
      const badString = '{ "a": 1, "b": 2, "c": 3 alksdj falsdj falsd jfalskd jfal;sdkjfaks}';

      assert.throws(() => JsonUtil.parseFrozen(badString));
    });

    it('returns a frozen object when passed a valid json string', () => {
      const jsonString = '{ "a": 1, "b": 2, "c": 3 }';
      const object = JsonUtil.parseFrozen(jsonString);

      assert.isFrozen(object);
      assert.isObject(object);
      assert.hasAllKeys(object, ['a', 'b', 'c']);
    });
  });
});
