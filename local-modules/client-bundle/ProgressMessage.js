// Copyright 2016 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Simple plugin to produce progress messages while building Webpack bundles.
 */
export default class ProgressMessage {
  /**
   * Constructs an instance.
   *
   * @param log The logger to use.
   */
  constructor(log) {
    /** Logger. */
    this._log = log;

    /**
     * Timestamp of the most recent progress message. Used to limit frequency of
     * messages so as not to spew too much.
     */
    this._lastTime = 0;
  }

  /**
   * Handles a progress message. Emits the message along with the percentage,
   * but only if (a) this is a message for the start or end of a task (0% or
   * 100%), or (b) the last progress message wasn't too recent.
   */
  _handler(frac, msg) {
    const now = Date.now();
    if ((frac > 0.0001) && (frac < 0.9999)) {
      // Not the start or end; check the timestamp. If it's within one second
      // (1000 msec), ignore it.
      if (now < (this._lastTime + 1000)) {
        return;
      }
    }

    if (msg === '') {
      if (frac >= 0.9999) {
        msg = 'done';
      } else {
        msg = 'still working';
      }
    }

    this._lastTime = now;
    this._log.info(`${Math.floor(frac * 100)}% -- ${msg}`);
  }

  /**
   * The progress handler function. Usable as-is (without `.bind()`).
   */
  get handler() {
    return this._handler.bind(this);
  }
}
