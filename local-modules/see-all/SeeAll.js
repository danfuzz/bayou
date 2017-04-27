// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import AllSinks from './AllSinks';

/**
 * Registry for loggers. This is an uninstantiable class with just static
 * methods.
 */
export default class SeeAll {
  /**
   * Adds a logging sink to the system. May be called more than once. Each sink
   * added via this method gets called as `sink.log(nowMsec, level, tag,
   * ...message)` and `sink.time(nowMsec, utcString, localString)`. The latter
   * are done as occasional "punctuation" on logs, for loggers that don't want
   * to record the exact timestamp of every message.
   *
   * @param {object} logger The underlying logger to use.
   */
  static add(sink) {
    AllSinks.theOne.add(sink);
  }
}
