// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import UtilityClass from './UtilityClass';

/**
 * `Object` helper utilities.
 */
export default class ObjectUtil extends UtilityClass {
  /**
   * Calls `value.hasOwnProperty()` safely.
   *
   * @param {object} value Value to query.
   * @param {string} name Name of property in question.
   * @returns {boolean} `true` iff `value` has an own-property with the given
   *   name.
   */
  static hasOwnProperty(value, name) {
    return Object.prototype.hasOwnProperty.call(value, name);
  }
}
