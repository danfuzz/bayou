// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Logger } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

/**
 * Mutable holder for aggregated log data for requests to a particular path.
 */
export class RequestAggregateData extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log Logger to use.
   */
  constructor(log) {
    super();

    /** {Logger} Logger to use. */
    this._log = Logger.check(log);
  }

  // **TODO:** Fill this in!
}
