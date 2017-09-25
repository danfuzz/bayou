// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import AuthorId from './AuthorId';
import BodyDelta from './BodyDelta';
import RevisionNumber from './RevisionNumber';
import Timestamp from './Timestamp';

/**
 * Representation of a change to a document body from its immediately-previous
 * revision, including time, authorship, and revision information in addition to
 * the actual delta. This class is a `BodyDelta` plus additional information.
 *
 * **Note:** The semantics of the `delta` in an instance of this class are more
 * specific than that of `BodyDelta` in general, exactly because instances
 * of this class always represent changes from the immediately-previous
 * revision.
 *
 * Instances of this class are immutable.
 */
export default class BodyChange extends CommonBase {
  /**
   * Gets the appropriate first change to a document body (empty delta, revision
   * number `0`, no author) for the current moment in time.
   *
   * @returns {BodyChange} An appropriate initial change.
   */
  static firstChange() {
    return new BodyChange(BodyDelta.EMPTY, 0, Timestamp.now(), null);
  }

  /**
   * Constructs an instance.
   *
   * @param {BodyDelta} delta The body change per se, compared to the
   *   immediately-previous revision. **Note:** This includes the resulting
   *   revision number.
   * @param {Int} revNum The revision number of the document produced by this
   *   instance (when composed as contextually appropriate). If this instance
   *   represents the first change to a document, then this value will be `0`.
   * @param {Timestamp|null} [timestamp = null] The time of the change, or
   *   `null` if the change doesn't have an associated moment of time.
   * @param {string|null} [authorId = null] Stable identifier string
   *   representing the author of the change. Allowed to be `null` if the change
   *   is authorless.
   */
  constructor(delta, revNum, timestamp = null, authorId = null) {
    super();

    /** {BodyDelta} The main content delta. */
    this._delta = BodyDelta.check(delta);

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {Timestamp|null} The time of the change. */
    this._timestamp = Timestamp.orNull(timestamp);

    /**
     * {string|null} Author ID string, or `null` if the change is
     * authorless.
     */
    this._authorId = AuthorId.orNull(authorId);

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    const result = [this._delta, this._revNum, this._timestamp, this._authorId];

    // Trim off one or two trailing `null`s, if possible.
    for (let i = 3; i >= 2; i--) {
      if (result[i] !== null) {
        break;
      }
      result.pop();
    }

    return result;
  }

  /**
   * {string|null} The author ID string, or `null` if the change is authorless
   * (or if the cocept of "author" is meaningless in the larger context of this
   * instance).
   */
  get authorId() {
    return this._authorId;
  }

  /** {BodyDelta} The main delta content. */
  get delta() {
    return this._delta;
  }

  /** {Timestamp} The time of the change. */
  get timestamp() {
    return this._timestamp;
  }
}
