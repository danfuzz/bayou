// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';

import DocControl from './DocControl';

/**
 * Controller for a given document, which acts on behalf of one specific author.
 * This passes non-mutating methods through to the underlying `DocControl` while
 * implicitly adding an author argument to methods that modify the document.
 */
export default class DocForAuthor {
  /**
   * Constructs an instance.
   *
   * @param {DocControl} doc The underlying document controller.
   * @param {string} authorId The author this instance acts on behalf of.
   */
  constructor(doc, authorId) {
    /** {DocControl} The underlying document controller. */
    this._doc = DocControl.check(doc);

    /** {string} Author ID. */
    this._authorId = TString.nonempty(authorId);
  }

  /**
   * Returns a particular change to the document. See the equivalent
   * `DocControl` method for details.
   *
   * @param {Int} revNum The revision number of the change.
   * @returns {Promise<DocumentChange>} Promise for the requested change.
   */
  change(revNum) {
    return this._doc.change(revNum);
  }

  /**
   * Returns a bit of identifying info about this instance, for the purposes of
   * logging. Specifically, the client side will call this method and log the
   * results during session initiation.
   *
   * @returns {string} A succinct identification string
   */
  getLogInfo() {
    return `doc ${this._doc.id}; author ${this._authorId}`;
  }

  /**
   * Returns a snapshot of the full document contents. See the equivalent
   * `DocControl` method for details.
   *
   * @param {Int|null} [revNum = null] Which version to get. If passed as
   *   `null`, indicates the latest (most recent) version.
   * @returns {Promise<Snapshot>} Promise for the requested snapshot.
   */
  snapshot(revNum = null) {
    return this._doc.snapshot(revNum);
  }

  /**
   * Returns a promise for a snapshot of any version after the given
   * `baseRevNum`. See the equivalent `DocControl` method for details.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @returns {Promise<DeltaResult>} Promise for a delta and associated version
   *   number. The result's `delta` can be applied to version `baseRevNum` to
   *   produce version `revNum` of the document.
   */
  deltaAfter(baseRevNum) {
    return this._doc.deltaAfter(baseRevNum);
  }

  /**
   * Applies a delta, assigning authorship of the change to the author
   * represented by this instance. See the equivalent `DocControl` method for
   * details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {FrozenDelta} delta Delta indicating what has changed with respect
   *   to `baseRevNum`.
   * @returns {Promise<DeltaResult>} Promise for the correction from the
   *   implied expected result to get the actual result.
   */
  applyDelta(baseRevNum, delta) {
    return this._doc.applyDelta(baseRevNum, delta, this._authorId);
  }
}
