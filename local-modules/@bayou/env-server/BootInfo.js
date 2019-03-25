// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { LogRecord } from '@bayou/see-all';
import { CommonBase } from '@bayou/util-common';

/**
 * Information about the booting of this server.
 */
export default class BootInfo extends CommonBase {
  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    const bootTime = Date.now();

    /** {Int} Time (Unix-epoch msec) when the server booted. */
    this._bootTime = bootTime;

    /** {string} String form of the boot time. */
    this._bootTimeString = LogRecord.forTime(bootTime).timeStrings.join(' / ');

    // **TODO:** Add other bits that are specific to this boot. Notably, we
    // have discussed trying to count how many times a given build has been
    // booted, and here is probably a reasonable place to have that.

    Object.freeze(this);
  }

  /**
   * {object} Ad-hoc object with the info from this instance.
   *
   * **Note:** This isn't all-caps `INFO` because it's not necessarily expected
   * to be a constant value in the long term (even though it happens to be so
   * as of this writing).
   */
  get info() {
    return {
      time:     this._bootTimeString,
      timeMsec: this._bootTime
    };
  }
}
