// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Singleton } from '@bayou/util-common';

import { AllSinks } from './AllSinks';

/**
 * Registry for loggers.
 */
export class SeeAll extends Singleton {
  /**
   * Adds a logging sink to the system. May be called more than once. Each sink
   * added via this method gets called as `sink.sinkLog(logRecord)`.
   *
   * @param {object} sink The underlying logger to use.
   */
  add(sink) {
    AllSinks.theOne.add(sink);
  }

  /**
   * Indicates if it is safe to call logging methods. This only returns `false`
   * during the earliest part of system bootstrap, before any logging sinks have
   * been added. As such, it's only necessary to call this if the code which
   * wants to log _might_ be called very early.
   *
   * @returns {boolean} `true` iff it is safe to call logging methods.
   */
  canLog() {
    return AllSinks.theOne.canLog();
  }
}
