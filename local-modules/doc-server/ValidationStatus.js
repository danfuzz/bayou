// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from 'util-common';

/**
 * Type representation of "validation status" values as used by
 * {@link BaseComplexMember#validationStatus} and
 * {@link FileBootstrap#_overallValidationStatus}. The values themselves are
 * just string constants. This class is merely where the constants and type
 * checker code live.
 */
export default class ValidationStatus extends UtilityClass {
  /**
   * {string} Validation status value, which indicates an unrecoverable error in
   * interpreting the document (or document portion) data.
   */
  static get STATUS_ERROR() {
    return 'status_error';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) is in a format that isn't directly understood, presumably
   * an older format that needs forward migration.
   */
  static get STATUS_MIGRATE() {
    return 'status_migrate';
  }

  /**
   * {string} Validation status value, which indicates that the file does not
   * exist.
   */
  static get STATUS_NOT_FOUND() {
    return 'status_not_found';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) checks out as valid.
   */
  static get STATUS_OK() {
    return 'status_ok';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) has some errors but _might_ be recoverable.
   */
  static get STATUS_RECOVER() {
    return 'status_recover';
  }

  /**
   * Checks that the given value is a valid "validation status" constant. Throws
   * an error if not.
   *
   * @param {*} value (Alleged) validation status.
   * @param {boolean} [allowNotFound = false] Whether to allow
   *   {@link #STATUS_NOT_FOUND} as a value. It defaults to `false`, because
   *   that value is only allowed in limited circumstances.
   * @returns {string} `value` if it is indeed valid.
   */
  static check(value, allowNotFound = false) {
    switch (value) {
      case ValidationStatus.STATUS_ERROR:
      case ValidationStatus.STATUS_MIGRATE:
      case ValidationStatus.STATUS_OK:
      case ValidationStatus.STATUS_RECOVER: {
        return value;
      }
      case ValidationStatus.STATUS_NOT_FOUND: {
        if (allowNotFound) {
          return value;
        }
        throw Errors.bad_value(value, ValidationStatus, 'value !== STATUS_NOT_FOUND');
      }
    }

    throw Errors.bad_value(value, ValidationStatus);
  }
}
