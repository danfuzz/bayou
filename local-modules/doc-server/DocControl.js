// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DeltaResult, FrozenDelta, Snapshot, Timestamp, VersionNumber }
  from 'doc-common';
import { BaseDoc } from 'doc-store';
import { TBoolean, TString } from 'typecheck';
import { CommonBase, PromCondition } from 'util-common';


/**
 * Controller for a given document. There is only ever exactly one instance of
 * this class per document, no matter how many active editors there are on that
 * document.
 */
export default class DocControl extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {BaseDoc} docStorage The underlying document storage.
   */
  constructor(docStorage) {
    super();

    /** {BaseDoc} Storage access for the document. */
    this._doc = BaseDoc.check(docStorage);

    /**
     * Mapping from version numbers to corresponding document snapshots.
     * Sparse.
     */
    this._snapshots = {};

    /**
     * Condition that transitions from `false` to `true` when there is a version
     * change and there are waiters for same. This remains `true` in the steady
     * state (when there are no waiters). As soon as the first waiter comes
     * along, it gets set to `false`.
     */
    this._changeCondition = new PromCondition(true);
  }

  /** {string} The ID of the document that this instance represents. */
  get id() {
    return this._doc.id;
  }

  /**
   * Returns a particular change to the document. The document consists of a
   * sequence of changes, each modifying version N of the document to produce
   * version N+1.
   *
   * @param {Int} verNum The version number of the change. The result is the
   *   change which produced that version. E.g., `0` is a request for the first
   *   change (the change from the empty document).
   * @returns {DocumentChange} An object representing that change.
   */
  change(verNum) {
    verNum = this._validateVerNum(verNum, false);
    return this._doc.changeRead(verNum);
  }

  /**
   * Returns a snapshot of the full document contents.
   *
   * @param {Int} [verNum] Indicates which version to get. If not passed,
   *   defaults to the latest (most recent) version.
   * @returns {Snapshot} The corresponding snapshot.
   */
  snapshot(verNum) {
    verNum = this._validateVerNum(verNum, true);

    if (verNum === null) {
      // This is an entirely empty document (probably because we're running in
      // a development environment and we found that the persistent data
      // wasn't in the latest format), and we got here because `verNum` wasn't
      // passed (that is, the client is asking for the latest version). We set
      // up a first version here and change `verNum` to `0`, which will
      // propagate through the rest of the code and end up making everything all
      // work out.
      this._doc.changeAppend(
        Timestamp.now(),
        [{ insert: '(Recreated document due to format version skew.)\n' }],
        null);
      verNum = 0;
    }

    // Search backward through the full versions for a base for forward
    // composition.
    let baseSnapshot = null;
    for (let i = verNum; i >= 0; i--) {
      const v = this._snapshots[i];
      if (v) {
        baseSnapshot = v;
        break;
      }
    }

    if (baseSnapshot === null) {
      // We have no snapshots at all, including of even the first version. Set
      // up a version 0 snapshot.
      baseSnapshot = this._snapshots[0] =
        new Snapshot(0, this._doc.changeRead(0).delta);
    }

    if (baseSnapshot.verNum === verNum) {
      // Found the right version!
      return baseSnapshot;
    }

    // We didn't actully find a snapshot of the requested version. Apply deltas
    // to the base to produce the desired version. Store it, and return it.

    let contents = baseSnapshot.contents;
    for (let i = baseSnapshot.verNum + 1; i <= verNum; i++) {
      contents = contents.compose(this._doc.changeRead(i).delta);
    }

    const result = new Snapshot(verNum, contents);
    this._snapshots[verNum] = result;
    return result;
  }

  /**
   * Returns a promise for a snapshot of any version after the given
   * `baseVerNum`, and relative to that version. If called when `baseVerNum`
   * is the current version, this will not resolve the result promise until at
   * least one change has been made.
   *
   * @param {Int} baseVerNum Version number for the document.
   * @returns {Promise<DeltaResult>} Promise for a delta and associated version
   *   number. The result's `delta` can be applied to version `baseVerNum` to
   *   produce version `verNum` of the document.
   */
  deltaAfter(baseVerNum) {
    baseVerNum = this._validateVerNum(baseVerNum, false);

    const currentVerNum = this._currentVerNum();

    if (baseVerNum !== currentVerNum) {
      // We can fulfill the result immediately. Compose all the deltas from
      // the version after the base through the current version.
      const delta = this._composeVersionsFrom(baseVerNum + 1);

      // We don't just return a plain value (that is, we still return a promise)
      // because of the usual hygenic recommendation to always return either
      // an immediate result or a promise from any given function.
      return Promise.resolve(new DeltaResult(currentVerNum, delta));
    }

    // Force the `_changeCondition` to `false` (though it might already be
    // so set; innocuous if so), and wait for it to become `true`.
    this._changeCondition.value = false;
    return this._changeCondition.whenTrue().then((value_unused) => {
      // Just recurse to do the work. Under normal circumstances it will return
      // promptly. This arrangement gracefully handles edge cases, though, such
      // as a triggered change turning out to be due to a no-op.
      return this.deltaAfter(baseVerNum);
    });
  }

  /**
   * Takes a base version number and delta therefrom, and applies the delta,
   * including merging of any intermediate versions. The return value consists
   * of a new version number, and a delta to be used to get the new document
   * state. The delta is with respect to the client's "expected result," that
   * is to say, what the client would get if the delta were applied with no
   * intervening changes.
   *
   * @param {Int} baseVerNum Version number which `delta` is with respect to.
   * @param {FrozenDelta} delta Delta indicating what has changed with respect
   *   to `baseVerNum`.
   * @param {string|null} authorId Author of `delta`, or `null` if the change
   *   is to be considered authorless.
   * @returns {Promise<DeltaResult>} Promise for the correction to the
   *   implied expected result of this operation. The `delta` of this result can
   *   be applied to the expected result to get the actual result. The promise
   *   resolves sometime after the delta has been applied to the document.
   */
  applyDelta(baseVerNum, delta, authorId) {
    baseVerNum = this._validateVerNum(baseVerNum, false);
    delta = FrozenDelta.check(delta);
    authorId = TString.orNull(authorId);

    // TODO: This `Promise.resolve()` cladding suffices to provide the
    // documented asynchronous API; however, the innards of this method should
    // actually be more async in their nature.
    return Promise.resolve(this._applyDelta(baseVerNum, delta, authorId));
  }

  /**
   * Main implementation of `applyDelta()`, see which for details. This method
   * is fully synchronous.
   *
   * @param {Int} baseVerNum Same as for `applyDelta()`.
   * @param {FrozenDelta} delta Same as for `applyDelta()`.
   * @param {string|null} authorId Same as for `applyDelta()`.
   * @returns {DeltaResult} Same as for `applyDelta()`, except not a
   *   promise.
   */
  _applyDelta(baseVerNum, delta, authorId) {
    if (baseVerNum === this._currentVerNum()) {
      // The easy case: Apply a delta to the current version (unless it's empty,
      // in which case we don't have to make a new version at all; that's
      // handled by `_appendDelta()`).
      this._appendDelta(delta, authorId);
      return new DeltaResult(
        this._currentVerNum(),  // `_appendDelta()` updates the version.
        FrozenDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a version of the document which is _not_
    // the current version (hereafter, `vBase` for the common base and
    // `vCurrent` for the current version). Here's what we do:
    //
    // 1. Construct a combined delta for all the server changes made between
    //    `vBase` and `vCurrent`. This is `dServer`.
    // 2. Transform (rebase) `dClient` with regard to (on top of) `dServer`.
    //    This is `dNext`. If `dNext` turns out to be empty, stop here and
    //    report that fact.
    // 3. Apply `dNext` to `vCurrent`, producing `vNext` as the new current
    //    server version.
    // 4. Apply `dClient` to `vBase` to produce `vExpected`, that is, the result
    //    that the client would have expected in the easy case. Construct a
    //    delta from `vExpected` to `vNext` (that is, the diff). This is
    //    `dCorrection`. This is what we return to the client; they will compose
    //    `vExpected` with `dCorrection` to arrive at `vNext`.

    // Assign variables from parameter and instance variables that correspond
    // to the description immediately above.
    const dClient    = delta;
    const vBaseNum   = baseVerNum;
    const vBase      = this.snapshot(vBaseNum).contents;
    const vCurrentNum = this._currentVerNum();

    // (1)
    const dServer = this._composeVersionsFrom(vBaseNum + 1);

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = FrozenDelta.coerce(dServer.transform(dClient, true));

    if (dNext.isEmpty()) {
      // It turns out that nothing changed.
      return new DeltaResult(vCurrentNum, FrozenDelta.EMPTY);
    }

    // (3)
    this._appendDelta(dNext, authorId);      // This updates the version number.
    const vNext = this.snapshot().contents;  // This lets the snapshot get cached.
    const vNextNum = this._currentVerNum();  // This will be different than `vCurrentNum`.

    // (4)
    const vExpected   = FrozenDelta.coerce(vBase).compose(dClient);
    const dCorrection = FrozenDelta.coerce(vExpected.diff(vNext));
    const vResultNum  = vNextNum;

    return new DeltaResult(vResultNum, dCorrection);
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial version through and including the current latest delta.
   * It is valid to pass `nextVerNum`, in which case this method returns an
   * empty delta. It is invalid to specify a non-existent version _other_ than
   * `nextVerNum`.
   *
   * @param {Int} startInclusive Version number for the first delta to include
   *   in the result.
   * @returns {FrozenDelta} The composed delta consisting of versions
   *   `startInclusive` through and including the current latest delta.
   */
  _composeVersionsFrom(startInclusive) {
    const nextVerNum = this._doc.nextVerNum;
    startInclusive = VersionNumber.check(startInclusive, nextVerNum);

    if (startInclusive === nextVerNum) {
      return FrozenDelta.EMPTY;
    }

    let result = this._doc.changeRead(startInclusive).delta;
    for (let i = startInclusive + 1; i < nextVerNum; i++) {
      result = result.compose(this._doc.changeRead(i).delta);
    }

    return FrozenDelta.coerce(result);
  }

  /**
   * Appends a new delta to the document. Also forces `_changeCondition`
   * `true` to release any waiters.
   *
   * **Note:** If the delta is a no-op, then this method does nothing.
   *
   * @param {object} delta The delta to append.
   * @param {string|null} authorId The author of the delta.
   */
  _appendDelta(delta, authorId) {
    authorId = TString.orNull(authorId);
    delta = FrozenDelta.coerce(delta);

    if (delta.isEmpty()) {
      return;
    }

    this._doc.changeAppend(Timestamp.now(), delta, authorId);
    this._changeCondition.value = true;
  }

  /**
   * Gets the version number corresponding to the current (latest) version of
   * the document.
   *
   * @returns {Int|null} The version number.
   */
  _currentVerNum() {
    return this._doc.currentVerNum();
  }

  /**
   * Checks a version number for sanity. Throws an error when insane.
   *
   * @param {*} verNum the (alleged) version number to check.
   * @param {boolean} wantCurrent If `true` indicates that `undefined` should be
   *   treated as a request for the current version. If `false`, `undefined` is
   *   an error.
   * @returns {number} The version number.
   */
  _validateVerNum(verNum, wantCurrent) {
    TBoolean.check(wantCurrent);

    const current = this._currentVerNum();

    if (wantCurrent) {
      return VersionNumber.check(verNum, current, current);
    } else {
      return VersionNumber.check(verNum, current);
    }
  }
}
