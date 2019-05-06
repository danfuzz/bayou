// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { assert } from 'chai';

import { InfoError, UtilityClass } from '@bayou/util-core';

/**
 * Additional assertion functions for use with this project.
 */
export class Assert extends UtilityClass {
  /**
   * Like `assert.throws()`, but specifically to check the details of an
   * expected `InfoError`.
   *
   * @param {function} func Function to call, expected to throw.
   * @param {string} name Expected error name.
   * @param {array|null} args Expected error arguments, or `null` if there are
   *   no expectations.
   */
  static throwsInfo(func, name, args = null) {
    try {
      func();
      assert.fail('Did not throw.');
    } catch (e) {
      assert.instanceOf(e, InfoError);
      assert.strictEqual(e.info.name, name);
      if (args !== null) {
        assert.deepEqual(e.info.args, args);
      }
    }
  }
}
