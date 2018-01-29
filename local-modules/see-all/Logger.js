// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TBoolean } from 'typecheck';

import AllSinks from './AllSinks';
import BaseLogger from './BaseLogger';
import LogTag from './LogTag';

/**
 * Logger which associates a tag (typically a subsystem or module name) and a
 * severity level (`info`, `error`, etc.) with all activity. Stack traces are
 * included for any message logged at a level that indicates any sort of
 * problem. One severity level, `detail`, is squelchable and is in fact
 * squelched by default. The rest are not squelchable.
 *
 * Full rundown of severity levels:
 *
 * * `debug` -- Severity level indicating temporary stuff for debugging. Code
 *   that uses this level should not in general get checked into the repo.
 *
 * * `error` -- Severity level indicating a dire error. Logs at this level
 *   should indicate something that went horribly awry, as opposed to just being
 *   a more innocuous errory thing that normally happens from time to time, such
 *   as, for example, a network connection that dropped unexpectedly.
 *
 * * `warn` -- Severity level indicating a warning. Trouble, but not dire. Logs
 *   at this level should indicate something that is out-of-the-ordinary but not
 *   unrecoverably so.
 *
 * * `info` -- Severity level indicating general info. No problem, but maybe you
 *   care. Logs at this level should come at a reasonably stately pace (maybe a
 *   couple times a minute or so) and give a general sense of the healthy
 *   operation of the system.
 *
 * * `detail` -- Severity level indicating detailed operation. These might be
 *   used multiple times per second, to provide a nuanced view into the
 *   operation of a component. These logs are squelched by default, as they
 *   typically distract from the big picture of the system. They are meant to be
 *   turned on selectively during development and debugging.
 */
export default class Logger extends BaseLogger {
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

  /**
   * Actual logging implementation, as specified by the superclass.
   *
   * @param {string} level Severity level. Guaranteed to be a valid level.
   * @param {array} message Array of arguments to log.
   */
  _impl_log(level, message) {
    if ((level === 'detail') && !this._enableDetail) {
      // This tag isn't listed as one to log at the `detail` level. (That is,
      // it's being squelched.)
      return;
    }

    AllSinks.theOne.log(level, this._tag, ...message);
  }

  /**
   * Subclass-specific context adder.
   *
   * @abstract
   * @param {...string} context Additional context strings. Guaranteed to be
   *   valid.
   * @returns {BaseLogger} An appropriately-constructed instance of this class.
   */
  _impl_withAddedContext(...context) {
    return new Logger(this._tag.withAddedContext(...context), this._enableDetail);
  }
}
