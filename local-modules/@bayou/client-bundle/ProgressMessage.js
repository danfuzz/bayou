// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from '@bayou/util-common';

/**
 * Simple plugin to produce progress messages while building Webpack bundles.
 */
export class ProgressMessage extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Logger} log The logger to use.
   */
  constructor(log) {
    super();

    /** {Logger} Logger. */
    this._log = log;

    /**
     * {Int} Timestamp of the most recent progress message. Used to limit
     * frequency of messages so as not to spew too much.
     */
    this._lastTime = 0;

    /**
     * {number} Last fraction reported. Used to ensure that progress is reported
     * as actually progressing, because Webpack sometimes ends up reporting a
     * trend in the wrong direction.
     */
    this._lastFrac = 0;
  }

  /**
   * Handles a progress message. Emits the message along with the percentage,
   * but only if (a) this is a message for the start or end of a task (0% or
   * 100%), or (b) the last progress message wasn't too recent.
   *
   * @param {number} frac Current estimate (between 0 and 1) of the completion
   *   of the compilation.
   * @param {string} msg Short descriptive message about what's currently
   *   happening.
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

    if (frac < 0.9999) {
      const minFrac = this._lastFrac;
      if (frac > minFrac) {
        // Conservatively estimate that we're only 90% of the way from the last
        // `frac` to this one, to start with, because Webpack will sometimes
        // increase its time estimate, which then makes `frac` move in the wrong
        // direction. With this wiggle room, we can show a little progress even
        // as Webpack flails a bit (achieved in the `else` clause immediately
        // below).
        const maxFrac = frac;
        frac = (maxFrac - minFrac) * 0.90 + minFrac;
      } else {
        // Webpack flailed, and `frac` is going the wrong way (or is stagnant).
        // Just bump it up a little bit from the last one we reported, unless
        // that would make it look done.
        frac = minFrac;
        if (frac < 0.98) {
          frac += 0.01;
        }
      }
    }

    this._lastTime = now;
    this._lastFrac = frac;
    this._log.event.buildingBundles(`${Math.floor(frac * 100)}%`, msg);
  }

  /**
   * The progress handler function. Usable as-is (without `.bind()`).
   */
  get handler() {
    return this._handler.bind(this);
  }

  /**
   * Resets progress, for a new round of work.
   */
  reset() {
    this._lastTime = 0;
    this._lastFrac= 0;
  }
}
