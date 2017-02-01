// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import DeltaUtil from 'delta-util';
import JsonUtil from 'json-util';
import Typecheck from 'typecheck';

/**
 * Representation of a change to a document, including time, authorship, and
 * version information in addition to the actual delta.
 *
 * Instances of this class are immutable, including the deltas. In particular,
 * if a mutable delta is passed to the constructor of this class, it is coerced
 * into immutable form.
 */
export default class DocumentChange {
  /**
   * Constructs an instance.
   *
   * @param {number} verNum The version number of the document produced by this
   *   change. If this instance represents the first change to a document, then
   *   this value will be `0`.
   * @param {number} timeMsec The time of the change, as msec since the Unix
   *   Epoch.
   * @param {Delta|array|object} delta The document change per se, compared to
   *   the immediately-previous version. Must be a value which can be coerced
   *   to a `FrozenDelta`.
   * @param {string|null} authorId Stable identifier string representing the
   *   author of the change. Allowed to be `null` if the change is authorless.
   */
  constructor(verNum, timeMsec, delta, authorId) {
    /** The produced version number. */
    this._verNum = Typecheck.versionNumber(verNum);

    /** The time of the change. */
    this._timeMsec = Typecheck.timeMsec(timeMsec);

    /** The actual change, as a delta. */
    this._delta = DeltaUtil.coerce(delta);

    /** Author ID string. */
    this._authorId = Typecheck.stringOrNull(authorId);
  }

  /**
   * Constructs an instance from the given network ("wire") representation.
   *
   * @param {string} rep The network ("wire") representation.
   * @returns {DocumentChange} An appropriately-constructed instance.
   */
  fromWire(rep) {
    const wire = JsonUtil.parseFrozen(rep);
    Typecheck.objectWithExactKeys('verNum', 'timeMsec', 'delta', 'authorId');
    return new DocumentChange(
      wire.verNum, wire.timeMsec, wire.delta, wire.authorId);
  }

  /**
   * Get a string form of this instance, suitable for passing over the
   * network ("wire" format).
   *
   * @returns {string} The string form.
   */
  toWire() {
    const wire = {
      verNum: this.verNum,
      timeMsec: this.timeMsec,
      delta: this.delta.ops,
      authorId: this.authorId
    };

    return JSON.stringify(wire, null, 2);
  }

  /** The produced version number. */
  get verNum() {
    return this._verNum;
  }

  /** The time of the change. */
  get timeMsec() {
    return this._timeMsec;
  }

  /** The actual change, as a delta. */
  get delta() {
    return this._delta;
  }

  /** The author ID string. */
  get authorId() {
    return this._authorId;
  }
}
