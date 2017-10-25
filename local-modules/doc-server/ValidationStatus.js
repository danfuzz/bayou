// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from 'util-common';

/**
 * Type representation of "validation status" values as defined by
 * {@link BaseComplexMember#validationStatus}. The values themselves are always
 * just strings. This is just where the constants and type checker code live.
 */
export default class ValidationStatus extends UtilityClass {
  /**
   * {string} Return value from {@link BaseComplexMember#validationStatus}, see
   * which for details.
   */
  static get STATUS_ERROR() {
    return 'status_error';
  }

  /**
   * {string} Return value from {@link BaseComplexMember#validationStatus}, see
   * which for details.
   */
  static get STATUS_MIGRATE() {
    return 'status_migrate';
  }

  /**
   * {string} Return value from {@link BaseComplexMember#validationStatus}, see
   * which for details.
   */
  static get STATUS_NOT_FOUND() {
    return 'status_not_found';
  }

  /**
   * {string} Return value from {@link BaseComplexMember#validationStatus}, see
   * which for details.
   */
  static get STATUS_OK() {
    return 'status_ok';
  }

  /**
   * {string} Return value from {@link BaseComplexMember#validationStatus}, see
   * which for details.
   */
  static get STATUS_RECOVER() {
    return 'status_recover';
  }

  /**
   * Checks that the given value is a valid "validation status" constant. Throws
   * an error if not.
   *
   * @param {*} value (Alleged) validation status.
   * @returns {string} `value` if it is indeed valid.
   */
  static check(value) {
    switch (value) {
      case ValidationStatus.STATUS_ERROR:
      case ValidationStatus.STATUS_MIGRATE:
      case ValidationStatus.STATUS_NOT_FOUND:
      case ValidationStatus.STATUS_OK:
      case ValidationStatus.STATUS_RECOVER: {
        return value;
      }
    }

    throw Errors.bad_value(value, ValidationStatus);
  }
}
