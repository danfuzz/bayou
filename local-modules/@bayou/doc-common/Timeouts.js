// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility class that just holds common timeout-related constants and utility
 * functions.
 */
export class Timeouts extends UtilityClass {
  /**
   * {Int} The maximum valid timeout, in msec. This value is picked so as to
   * avoid "promise pileup" on code which issues requests which end up getting
   * dropped / ignored, only to reissue new ones. (For the most part, this
   * tactic lets us avoid worrying about canceling calls.)
   */
  static get MAX_TIMEOUT_MSEC() {
    return 60 * 1000; // One minute.
  }

  /**
   * {Int} The minimum valid timeout, in msec. This value is picked so that
   * "eager" code won't wait too long for a timeout, while still avoiding
   * spinning the system to death.
   */
  static get MIN_TIMEOUT_MSEC() {
    return 1000; // One second.
  }

  /**
   * Clamps a timeout value to the defined range. Also accepts `null`, which
   * gets converted to the maximum value.
   *
   * @param {Int|null} timeoutMsec Client-supplied timeout value. If non-`null`,
   *   must be a non-negative integer.
   * @returns {Int} In-range timeout value.
   */
  static clamp(timeoutMsec) {
    if (timeoutMsec === null) {
      return Timeouts.MAX_TIMEOUT_MSEC;
    }

    TInt.nonNegative(timeoutMsec);

    if (timeoutMsec < Timeouts.MIN_TIMEOUT_MSEC) {
      return Timeouts.MIN_TIMEOUT_MSEC;
    } else if (timeoutMsec > Timeouts.MAX_TIMEOUT_MSEC) {
      return Timeouts.MAX_TIMEOUT_MSEC;
    }

    return timeoutMsec;
  }
}
