// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding log handling.
 */
export default class Logging extends UtilityClass {
  /**
   * Performs redaction on an event log payload.
   *
   * @param {Functor} payload Original event payload.
   * @returns {Functor} Redacted replacement payload, or `payload` as given if
   *   no redaction is necessary.
   */
  static redactEvent(payload) {
    return use.Logging.redactEvent(payload);
  }

  /**
   * Performs redaction on an ad-hoc logged message (e.g., the arguments to a
   * call to `log.info()`).
   *
   * @param {...*} message Original message arguments.
   * @returns {array<*>} Redacted replacement arguments, or `args` as given if
   *   no redaction is necessary.
   */
  static redactMessage(...message) {
    return use.Logging.redactMessage(...message);
  }

  /**
   * Performs redaction on a logging tag.
   *
   * @param {LogTag} tag Original tag.
   * @returns {LogTag} Redacted replacement for `tag`, or `tag` itself if no
   *   redaction is necessary.
   */
  static redactTag(tag) {
    return use.Logging.redactTag(tag);
  }
}
