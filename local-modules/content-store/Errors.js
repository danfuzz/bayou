// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt, TString } from 'typecheck';
import { InfoError, UtilityClass } from 'util-common';

/**
 * Utility class for constructing errors salient to this module.
 *
 * **Note:** The names of the methods match the functor names, and because the
 * convention for those is `lowercase_underscore`, that is what's used.
 */
export default class Errors extends UtilityClass {
  /**
   * Constructs an error indicating that a transaction timed out.
   *
   * @param {Int} timeoutMsec The original length of the timeout, in msec.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static transaction_timed_out(timeoutMsec) {
    TInt.check(timeoutMsec);
    return new InfoError('transaction_timed_out', timeoutMsec);
  }

  /**
   * Constructs an error indicating that a file does not exist.
   *
   * @param {string} id ID of the file.
   * @returns {InfoError} An appropriately-constructed error.
   */
  static file_not_found(id) {
    TString.check(id);
    return new InfoError('file_not_found', id);
  }
}
