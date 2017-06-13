// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from 'util-common-base';

import TypeError from './TypeError';

/**
 * Type checker for type `Boolean`.
 */
export default class TBoolean extends UtilityClass {
  /**
   * Checks a value of type `Boolean`.
   *
   * @param {*} value The (alleged) boolean.
   * @param {boolean|null} [defaultValue = null] Default value. If passed,
   *   indicates that `undefined` should be treated as that value. If not
   *   passed, `undefined` is an error.
   * @returns {boolean} `value` or `defaultValue`.
   */
  static check(value, defaultValue = null) {
    if ((value === undefined) && (defaultValue !== null)) {
      value = defaultValue;
    }

    if (typeof value !== 'boolean') {
      return TypeError.badValue(value, 'Boolean');
    }

    return value;
  }
}
