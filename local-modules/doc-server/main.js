// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import DeltaUtil from 'delta-util';
import PromCondition from 'prom-condition';
import Typecheck from 'typecheck';

import DocumentChange from './DocumentChange';
import default_document from './default-document';


/**
 * Server-side representation of a persistent document.
 *
 * TODO: Be persistent.
 */
export default class DocServer {
  /**
   * Constructs an instance.
   */
  constructor() {
    /**
     * List of changes that in aggregate represent the document. Each element
     * is a `DocumentChange`. The first element is always a change-from-empty.
     * Composing elements `0..N` results in version `N` of the document.
     */
    this._changes = [];

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

    // Initialize the document with static content (for now).
    const firstChange =
      new DocumentChange(0, Date.now(), default_document, null);
    this._changes.push(firstChange);
  }

  /**
   * The version number corresponding to the current (latest) version of the
   * document.
   */
  get currentVerNum() {
    return this._changes.length - 1;
  }

  /**
   * The version number corresponding to the very next change that will be
   * made to the document.
   */
  get nextVerNum() {
    return this._changes.length;
  }

  /**
   * Returns a particular change to the document. The document consists of a
   * sequence of changes, each modifying version N of the document to produce
   * version N+1.
   *
   * @param {number} [verNum = this.currentVerNum] The version number of the
   *   change. The result is the change which produced that version. E.g., `0`
   *   is a request for the first change (the change from the empty document).
   * @returns {DocumentChange} An object representing that change.
   */
  change(verNum) {
    verNum = this._validateVerNum(verNum, true);
    return this._changes[verNum];
  }

  /**
   * Returns a snapshot of the full document contents.
   *
   * @param {number} [verNum = this.currentVerNum] Indicates which version to
   *   get.
   * @returns {object} An object that maps `contents` to the document contents
   *   (delta from empty) and `verNum` to the version number.
   */
  snapshot(verNum) {
    verNum = this._validateVerNum(verNum, true);

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
      // up version 0.
      baseSnapshot = this._snapshots[0] = {
        contents: this._changes[0].delta,
        verNum:   0
      };
    }

    if (baseSnapshot.verNum === verNum) {
      // Found the right version!
      return baseSnapshot;
    }

    // We didn't actully find a snapshot of the requested version. Apply deltas
    // to the base to produce the desired version. Store it, and return it.

    let contents = baseSnapshot.contents;
    for (let i = baseSnapshot.verNum + 1; i <= verNum; i++) {
      contents = contents.compose(this._changes[i].delta);
    }

    contents = DeltaUtil.coerce(contents);
    const result = {verNum, contents};
    this._snapshots[verNum] = result;
    return result;
  }

  /**
   * Returns a promise for a snapshot of any version after the given
   * `baseVerNum`, and relative to that version. If called when `baseVerNum`
   * is the current version, this will not resolve the result promise until at
   * least one change has been made.
   *
   * @param {number} baseVerNum Version number for the document.
   * @returns {Promise} A promise which ultimately resolves to an object that
   *   maps `verNum` to the new version and `delta` to a change with respect to
   *   `baseVerNum`.
   */
  deltaAfter(baseVerNum) {
    const currentVerNum = this.currentVerNum;
    baseVerNum = this._validateVerNum(baseVerNum, false);

    if (baseVerNum !== currentVerNum) {
      // We can fulfill the result immediately. Compose all the deltas from
      // the version after the base through the current version.
      const delta = this._composeVersions(baseVerNum + 1);

      // We don't just return a plain value (that is, we still return a promise)
      // because of the usual hygenic recommendation to always return either
      // an immediate result or a promise from any given function.
      return Promise.resolve({verNum: currentVerNum, delta});
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
   * @param {number} baseVerNum Version number which `delta` is with respect to.
   * @param {object} delta Delta indicating what has changed with respect to
   *   `baseVerNum`.
   * @returns {object} Object that binds `verNum` to the new version number and
   *   `delta` to a delta _with respect to the implied expected result_ which
   *   can be used to get the new document state.
   */
  applyDelta(baseVerNum, delta) {
    baseVerNum = this._validateVerNum(baseVerNum, false);
    delta = Typecheck.frozenDelta(delta, true);

    if (baseVerNum === this.currentVerNum) {
      // The easy case: Apply a delta to the current version (unless it's empty,
      // in which case we don't have to make a new version at all; that's
      // handled by `_appendDelta()`).
      this._appendDelta(delta);
      return {
        delta:  [], // That is, there was no correction.
        verNum: this.currentVerNum // `_appendDelta()` updates the version.
      };
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
    const vCurrentNum = this.currentVerNum;

    // (1)
    const dServer = this._composeVersions(vBaseNum + 1);

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = dServer.transform(dClient, true);

    if (DeltaUtil.isEmpty(dNext)) {
      // It turns out that nothing changed.
      return {
        delta:  [], // That is, there was no correction.
        verNum: vCurrentNum
      };
    }

    // (3)
    this._appendDelta(dNext);
    const vNext = this.snapshot().contents;  // This lets the snapshot get cached.
    const vNextNum = this.currentVerNum;     // This will be different than `vCurrentNum`.

    // (4)
    const vExpected = DeltaUtil.coerce(vBase).compose(dClient);
    const dCorrection = vExpected.diff(vNext);

    return {
      delta:  dCorrection,
      verNum: vNextNum
    };
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial version (inclusive) through the given final version
   * (exclusive). It is valid for the range to be empty, in which case this
   * returns an empty delta. It is invalid for the start and end to be
   * inverted (that is, `end < start`). It is also invalid for the range to
   * include non-existent versions (negative or too large).
   *
   * @param {number} startInclusive Version number for the first delta to
   *   include in the result.
   * @param {number} [endExclusive = this.nextVerNum] Version number for just
   *   after the last delta to include, or alternatively thought, of the first
   *   version to exclude from the result.
   * @returns {FrozenDelta} The composed delta consisting of versions
   *   `startInclusive` through but not including `endExclusive`.
   */
  _composeVersions(startInclusive, endExclusive = this.nextVerNum) {
    // Validate parameters.
    startInclusive = Typecheck.intMin(startInclusive, 0);
    endExclusive =
      Typecheck.intRangeInc(endExclusive, startInclusive, this.nextVerNum);

    if (startInclusive === endExclusive) {
      return DeltaUtil.EMPTY_DELTA;
    }

    let result = this._changes[startInclusive].delta;
    for (let i = startInclusive + 1; i < endExclusive; i++) {
      result = result.compose(this._changes[i].delta);
    }

    return DeltaUtil.coerce(result);
  }

  /**
   * Appends a new delta to the document. Also forces `_changeCondition`
   * `true` to release any waiters.
   *
   * **Note:** If the delta is a no-op, then this method does nothing.
   *
   * @param {object} delta The delta to append.
   */
  _appendDelta(delta) {
    delta = Typecheck.frozenDelta(delta, true);

    if (DeltaUtil.isEmpty(delta)) {
      return;
    }

    // TODO: Assign an author.
    const change = new DocumentChange(this.nextVerNum, Date.now(), delta, null);
    this._changes.push(change);
    this._changeCondition.value = true;
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
    const current = this.currentVerNum;

    if (wantCurrent) {
      return Typecheck.versionNumber(verNum, current, current);
    } else {
      return Typecheck.versionNumber(verNum, current);
    }
  }
}
