// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TString } from 'typecheck';

import DocumentDelta from './DocumentDelta';
import Timestamp from './Timestamp';

/**
 * Representation of a change to a document from its immediately-previous
 * revision, including time, authorship, and revision information in addition to
 * the actual delta. This class is a `DocumentDelta` plus additional metadata,
 * and it in fact derives from `DocumentDelta` per se.
 *
 * **Note:** The meaning of the `delta` in an instance of this class is more
 * specific than that of `DocumentDelta` in general, exactly because instances
 * of this class always represent changes from the immediately-previous
 * revision.
 *
 * Instances of this class are immutable, including the deltas. In particular,
 * if a mutable delta is passed to the constructor of this class, it is coerced
 * into immutable form.
 */
export default class DocumentChange extends DocumentDelta {
  /**
   * Gets the appropriate first change to a document (empty delta, no author)
   * for the current moment in time.
   *
   * @returns {FrozenDelta} An appropriate initial change.
   */
  static firstChange() {
    return new DocumentChange(0, FrozenDelta.EMPTY, Timestamp.now(), null);
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum The revision number of the document produced by this
   *   change. If this instance represents the first change to a document,
   *   then this value will be `0`.
   * @param {FrozenDelta} delta The document change per se, compared to the
   *   immediately-previous revision.
   * @param {Timestamp} timestamp The time of the change, as msec since the Unix
   *   Epoch.
   * @param {string|null} authorId Stable identifier string representing the
   *   author of the change. Allowed to be `null` if the change is authorless.
   */
  constructor(revNum, delta, timestamp, authorId) {
    super(revNum, delta,
      function init() {
        /** {Timestamp} The time of the change. */
        this._timestamp = Timestamp.check(timestamp);

        /**
         * {string|null} Author ID string, or `null` if the change is
         * authorless.
         */
        this._authorId = TString.orNull(authorId);
      });
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._delta, this._timestamp, this.authorId];
  }

  /**
   * {string|null} The author ID string, or `null` if the change is authorless.
   */
  get authorId() {
    return this._authorId;
  }

  /** {Timestamp} The time of the change. */
  get timestamp() {
    return this._timestamp;
  }
}
