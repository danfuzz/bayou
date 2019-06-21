// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DocComplex } from '@bayou/doc-server';
import { TInt, TObject } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

/**
 * {Int} The number of document sessions which should be considered to
 * constitute a "heavy load."
 */
const HEAVY_SESSION_COUNT = 100;

/**
 * Synthesizer of the high-level "load factor" based on various stats on what
 * this server is up to.
 */
export class LoadFactor extends CommonBase {
  /**
   * {Int} Value of {@link #_value} above which the system should be considered
   * "under heavy load."
   */
  static get HEAVY_LOAD_VALUE() {
    return 100;
  }

  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    /** {Int} Current (latest calculated) load factor. */
    this._value = 0;

    /** {Int} {@link DocServer} resource consumption stat. */
    this._roughSize = 0;

    /** {Int} {@link DocServer} resource consumption stat. */
    this._sessionCount = 0;

    Object.seal(this);
  }

  /** {Int} The current (latest calculated) load factor. */
  get value() {
    return this._value;
  }

  /**
   * Update this instance based on the given resource consumption stats, which
   * are expected to be in the form reported by
   * {@link DocServer#currentResourceConsumption}.
   *
   * @param {object} stats Stats, per the contract of {@link DocServer}.
   */
  docServerStats(stats) {
    TObject.check(stats);

    if (stats.roughSize !== undefined) {
      this._roughSize = TInt.check(stats.roughSize);
    }

    if (stats.sessionCount !== undefined) {
      this._sessionCount = TInt.check(stats.sessionCount);
    }

    this._recalc();
  }

  /**
   * (Re)calculates {@link #value} based on currently-known stats.
   *
   * What we do is define N independent numeric stats each of which has a value
   * beyond which it is considered "heavy load." These each scaled so that the
   * "heavy load" value maps to {@link #HEAVY_LOAD_VALUE}, and then they're
   * simply summed. This means that (a) all stats always contribute to the final
   * load factor value, and (b) each stat can _independently_ cause the final
   * load factor to be in the "heavy load" zone.
   */
  _recalc() {
    // Get each of these as a fraction where `0` is "unloaded" and `1` is heavy
    // load.
    const roughSize    = this._roughSize    / DocComplex.ROUGH_SIZE_HUGE;
    const sessionCount = this._sessionCount / HEAVY_SESSION_COUNT;

    // Total load.
    const total = roughSize + sessionCount;

    // Total load, scaled so that heavy load is at the documented
    // `HEAVY_LOAD_VALUE`, and rounded to an int.
    const loadFactor = Math.round(total * LoadFactor.HEAVY_LOAD_VALUE);

    this._value = loadFactor;
  }
}
