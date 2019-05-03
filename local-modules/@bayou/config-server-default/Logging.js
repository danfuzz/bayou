// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding log handling.
 *
 * This (default) implementation treats redaction as a no-op, which is of course
 * inappropriate for a production configuration.
 */
export class Logging extends UtilityClass {
  /**
   * Implementation of standard configuration point.
   *
   * This implementation is a no-op, always returning its argument unchanged.
   *
   * @param {Functor} payload Original event payload.
   * @returns {Functor} `payload` as given.
   */
  static redactEvent(payload) {
    return payload;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation is a no-op, always returning its arguments unchanged.
   *
   * @param {...*} message Original message arguments.
   * @returns {array<*>} `args` as given.
   */
  static redactMessage(...message) {
    return message;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation is a no-op, always returning its arguments unchanged.
   *
   * @param {Functor} payload Original event payload.
   * @returns {Functor} Redacted replacement payload, or `payload` as given if
   *   no redaction is necessary.
   */
  static redactMetric(payload) {
    return payload;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation is a no-op, always returning its argument unchanged.
   *
   * @param {LogTag} tag Original tag.
   * @returns {LogTag} `tag` as given.
   */
  static redactTag(tag) {
    return tag;
  }

  /**
   * Implementation of standard configuration point.
   *
   * This implementation always returns `false`.
   *
   * @returns {boolean} `false`, always.
   */
  static shouldRedact() {
    return false;
  }
}
