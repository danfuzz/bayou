// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean } from '@bayou/typecheck';

import { AllSinks } from './AllSinks';
import { BaseLogger } from './BaseLogger';
import { LogTag } from './LogTag';

/**
 * Logger which associates a tag (typically a subsystem or module name) with all
 * activity, and a severity level (`info`, `error`, etc.) with all ad-hoc
 * human-oriented messages (as opposed to structured events). Stack traces are
 * included for any item logged at a level that indicates any sort of problem.
 * One severity level, `detail`, is squelchable and is in fact squelched by
 * default. The rest are not squelchable. See {@link LogRecord} for more
 * details.
 */
export class Logger extends BaseLogger {
  /**
   * Constructs an instance.
   *
   * @param {LogTag|string} tag Tag to use with messages logged by this
   *   instance. If passed as a string, this constructor automatically creates
   *   a corresponding {@link LogTag} instance (with no extra context strings).
   * @param {boolean} [enableDetail = false] Whether or not to produce logs at
   *   the `detail` level.
   */
  constructor(tag, enableDetail = false) {
    super();

    /** {LogTag} The module / subsystem (plus context) tag. */
    this._tag = (tag instanceof LogTag) ? tag : new LogTag(tag);

    /** {boolean} Whether logging is enabled for the `detail` level. */
    this._enableDetail = TBoolean.check(enableDetail);

    Object.freeze(this);
  }

  /** {LogTag} The tag(s) used by this instance when logging. */
  get tag() {
    return this._tag;
  }

  /**
   * Actual logging implementation for structured events, as specified by the
   * superclass.
   *
   * @param {Functor} payload Event payload.
   */
  _impl_logEvent(payload) {
    AllSinks.theOne.logEvent(this._tag, payload);
  }

  /**
   * Actual logging implementation for ad-hoc messages, as specified by the
   * superclass.
   *
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _impl_logMessage(level, message) {
    if ((level === 'detail') && !this._enableDetail) {
      // This tag isn't listed as one to log at the `detail` level. (That is,
      // it's being squelched.)
      return;
    }

    AllSinks.theOne.logMessage(this._tag, level, ...message);
  }

  /**
   * Subclass-specific context adder.
   *
   * @param {...string} context Additional context strings. Guaranteed to be
   *   valid.
   * @returns {BaseLogger} An appropriately-constructed instance of this class.
   */
  _impl_withAddedContext(...context) {
    return new Logger(this._tag.withAddedContext(...context), this._enableDetail);
  }
}
