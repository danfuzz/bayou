// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import AuthorId from './AuthorId';
import BodyDelta from './BodyDelta';
import RevisionNumber from './RevisionNumber';
import Timestamp from './Timestamp';

/**
 * {BodyChange|null} Representation of the empty (and authorless and timeless)
 * first change to a document. Initialized in the static getter of the same
 * name.
 */
let FIRST = null;

/**
 * Representation of a change to a document body from its immediately-previous
 * revision, including time, authorship, and revision information in addition to
 * the actual delta. This class is a `BodyDelta` plus additional information.
 *
 * Instances of this class are returned from calls to `body_update()` and
 * `body_deltaAfter()` as defined by the various `doc-server` classes. See those
 * for more details. Note that the meaning of the `delta` value is different
 * depending on which method the result came from. In particular, there is an
 * implied "expected" result from `body_update()` which this instance's
 * `delta` is with respect to.
 *
 * Instances of this class are immutable.
 */
export default class BodyChange extends CommonBase {
  /**
   * {BodyChange} Representation of the empty (and authorless and timeless)
   * first change to a document.
   */
  static get FIRST() {
    if (FIRST === null) {
      FIRST = new BodyChange(0, BodyDelta.EMPTY);
    }

    return FIRST;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum The revision number of the document produced by this
   *   instance (when composed as contextually appropriate). If this instance
   *   represents the first change to a document, then this value will be `0`.
   * @param {BodyDelta} delta The body change per se, compared to the
   *   implied base revision.
   * @param {Timestamp|null} [timestamp = null] The time of the change, or
   *   `null` if the change doesn't have an associated moment of time.
   * @param {string|null} [authorId = null] Stable identifier string
   *   representing the author of the change. Allowed to be `null` if the change
   *   is authorless.
   */
  constructor(revNum, delta, timestamp = null, authorId = null) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {BodyDelta} The main content delta. */
    this._delta = BodyDelta.check(delta);

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
    const result = [this._revNum, this._delta, this._timestamp, this._authorId];

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

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {Timestamp|null} The time of the change, or `null` if the change has no
   * specific associated moment in time.
   */
  get timestamp() {
    return this._timestamp;
  }
}
