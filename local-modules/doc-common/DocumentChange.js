// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import Timestamp from './Timestamp';
import RevisionNumber from './RevisionNumber';

/**
 * Representation of a change to a document from its immediately-previous
 * revision, including time, authorship, and revision information in addition to
 * the actual delta.
 *
 * Instances of this class are immutable, including the deltas. In particular,
 * if a mutable delta is passed to the constructor of this class, it is coerced
 * into immutable form.
 */
export default class DocumentChange extends CommonBase {
  /**
   * Gets the appropriate first change to a document (empty delta, no author)
   * for the current moment in time.
   *
   * @returns {FrozenDelta} An appropriate initial change.
   */
  static firstChange() {
    return new DocumentChange(0, Timestamp.now(), FrozenDelta.EMPTY, null);
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum The revision number of the document produced by this
   *   change. If this instance represents the first change to a document,
   *   then this value will be `0`.
   * @param {Timestamp} timestamp The time of the change, as msec since the Unix
   *   Epoch.
   * @param {Delta|array|object} delta The document change per se, compared to
   *   the immediately-previous revision. Must be a value which can be coerced
   *   to a `FrozenDelta`.
   * @param {string|null} authorId Stable identifier string representing the
   *   author of the change. Allowed to be `null` if the change is authorless.
   */
  constructor(revNum, timestamp, delta, authorId) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {Timestamp} The time of the change. */
    this._timestamp = Timestamp.check(timestamp);

    /** {FrozenDelta} The actual change, as a delta. */
    this._delta = FrozenDelta.coerce(delta);

    /**
     * {string|null} Author ID string, or `null` if the change is authorless.
     */
    this._authorId = TString.orNull(authorId);

    Object.freeze(this);
  }

  /** {string} Name of this class in the API. */
  static get API_NAME() {
    return 'DocumentChange';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._timestamp, this._delta, this.authorId];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {Int} revNum Same as with the regular constructor.
   * @param {Timestamp} timestamp Same as with the regular constructor.
   * @param {Delta|array|object} delta Same as with the regular constructor.
   * @param {string|null} authorId Same as with the regular constructor.
   * @returns {DocumentChange} The constructed instance.
   */
  static fromApi(revNum, timestamp, delta, authorId) {
    return new DocumentChange(revNum, timestamp, delta, authorId);
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /** {Timestamp} The time of the change. */
  get timestamp() {
    return this._timestamp;
  }

  /** {FrozenDelta} The actual change, as a delta. */
  get delta() {
    return this._delta;
  }

  /**
   * {string|null} The author ID string, or `null` if the change is authorless.
   */
  get authorId() {
    return this._authorId;
  }
}
