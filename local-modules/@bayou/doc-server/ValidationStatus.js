// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Errors, UtilityClass } from '@bayou/util-common';

/**
 * Type representation of "validation status" values as used by
 * {@link BaseComplexMember#validationStatus}. The values themselves are just
 * string constants. This class is merely where the constants and type checker
 * code live.
 */
export class ValidationStatus extends UtilityClass {
  /**
   * {string} Validation status value, which indicates an unrecoverable error in
   * interpreting the document (or document portion) data.
   */
  static get STATUS_error() {
    return 'error';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) is in a format that isn't directly understood, presumably
   * an older format that needs forward migration.
   */
  static get STATUS_migrate() {
    return 'migrate';
  }

  /**
   * {string} Validation status value, which indicates that the file does not
   * exist.
   */
  static get STATUS_notFound() {
    return 'notFound';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) checks out as valid.
   */
  static get STATUS_ok() {
    return 'ok';
  }

  /**
   * {string} Validation status value, which indicates that the document (or
   * document portion) has some errors but _might_ be recoverable.
   */
  static get STATUS_recover() {
    return 'recover';
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
      case ValidationStatus.STATUS_error:
      case ValidationStatus.STATUS_migrate:
      case ValidationStatus.STATUS_notFound:
      case ValidationStatus.STATUS_ok:
      case ValidationStatus.STATUS_recover: {
        return value;
      }
    }

    throw Errors.badValue(value, ValidationStatus);
  }
}
