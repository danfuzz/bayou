// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { FrozenDelta } from 'doc-common';
import { TString } from 'typecheck';
import { CommonBase } from 'util-common';

import Timestamp from './Timestamp';
import VersionNumber from './VersionNumber';

/**
 * Representation of a change to a document from its immediately-previous
 * version, including time, authorship, and version information in addition to
 * the actual delta.
 *
 * Instances of this class are immutable, including the deltas. In particular,
 * if a mutable delta is passed to the constructor of this class, it is coerced
 * into immutable form.
 */
export default class DocumentChange extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {number} verNum The version number of the document produced by this
   *   change. If this instance represents the first change to a document, then
   *   this value will be `0`.
   * @param {Timestamp} timestamp The time of the change, as msec since the Unix
   *   Epoch.
   * @param {Delta|array|object} delta The document change per se, compared to
   *   the immediately-previous version. Must be a value which can be coerced
   *   to a `FrozenDelta`.
   * @param {string|null} authorId Stable identifier string representing the
   *   author of the change. Allowed to be `null` if the change is authorless.
   */
  constructor(verNum, timestamp, delta, authorId) {
    super();

    /** The produced version number. */
    this._verNum = VersionNumber.check(verNum);

    /** The time of the change. */
    this._timestamp = Timestamp.check(timestamp);

    /** The actual change, as a delta. */
    this._delta = FrozenDelta.coerce(delta);

    /** Author ID string. */
    this._authorId = TString.orNull(authorId);
  }

  /** Name of this class in the API. */
  static get API_NAME() {
    return 'DocumentChange';
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._verNum, this._timestamp, this._delta, this.authorId];
  }

  /**
   * Constructs an instance from API arguments.
   *
   * @param {number} verNum Same as with the regular constructor.
   * @param {Timestamp} timestamp Same as with the regular constructor.
   * @param {Delta|array|object} delta Same as with the regular constructor.
   * @param {string|null} authorId Same as with the regular constructor.
   * @returns {DocumentChange} The constructed instance.
   */
  static fromApi(verNum, timestamp, delta, authorId) {
    return new DocumentChange(verNum, timestamp, delta, authorId);
  }

  /** The produced version number. */
  get verNum() {
    return this._verNum;
  }

  /** The time of the change. */
  get timestamp() {
    return this._timestamp;
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
