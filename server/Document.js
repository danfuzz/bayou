// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import Delta from 'quill-delta';

import DeltaUtil from 'delta-util';
import PromCondition from 'prom-condition';

import default_document from './default-document';


/**
 * Representation of a persistent document, along with a set of clients.
 *
 * TODO: Be persistent.
 */
export default class Document {
  /**
   * Constructs an instance.
   */
  constructor() {
    /**
     * List of changes that in aggregate represent the document. Each element
     * is a Delta. The first element is always a delta-from-empty. Composing
     * elements `0..N` results in version `N` of the document.
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
    const firstVersion = new Delta(default_document);
    this._changes.push(firstVersion);
  }

  /**
   * The version number corresponding to the current (latest) version of the
   * document.
   */
  get latestVersion() {
    return this._changes.length - 1;
  }

  /**
   * The version number corresponding to the very next change that will be
   * made to the document.
   */
  get nextVersion() {
    return this._changes.length;
  }

  /**
   * Returns a particular change to the document. The document consists of a
   * sequence of changes, each modifying version N of the document to produce
   * version N+1.
   *
   * @param version The version number of the change. The result is the change
   *   which produced that version. E.g., `0` is a request for the first change
   *   (the change from the empty document).
   * @returns An object representing that change.
   */
  change(version) {
    version = this._versionNumber(version);
    return this._changes[version];
  }

  /**
   * Returns a snapshot of the full document contents.
   *
   * @param version (optional) Indicates which version to get; defaults to the
   *   current version.
   * @returns An object that maps `data` to the document data and `version` to
   *   the version number.
   */
  snapshot(version) {
    version = this._versionNumber(version, true);

    // Search backward through the full versions for a base for forward
    // composition.
    let baseSnapshot = null;
    for (let i = version; i >= 0; i--) {
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
        data: this._changes[0],
        version: 0
      };
    }

    if (baseSnapshot.version === version) {
      // Found the right version!
      return baseSnapshot;
    }

    // We didn't actully find a snapshot of the requested version. Apply deltas
    // to the base to produce the desired version. Store it, and return it.

    let data = baseSnapshot.data;
    for (let i = baseSnapshot.version + 1; i <= version; i++) {
      data = data.compose(this._changes[i]);
    }

    const result = {
      data: data,
      version: version
    };

    this._snapshots[version] = result;
    return result;
  }

  /**
   * Returns a promise for a snapshot of any version after the given
   * `baseVersion`, and relative to that version. If called when `baseVersion`
   * is the current version, this will not resolve the result promise until at
   * least one change has been made.
   *
   * @param baseVersion Version number for the document.
   * @returns A promise which ultimately resolves to an object that maps
   *   `version` to the new version and `delta` to a change with respect to
   *   `baseVersion`.
   */
  deltaAfter(baseVersion) {
    const latestVersion = this.latestVersion;
    baseVersion = this._versionNumber(baseVersion, false);

    if (baseVersion !== latestVersion) {
      // We can fulfill the result immediately. Compose all the deltas from
      // the version after the base through the current version.
      const delta = this._composeVersions(baseVersion + 1);

      // We don't just return a plain value (that is, we still return a promise)
      // because of the usual hygenic recommendation to always return either
      // an immediate result or a promise from any given function.
      return Promise.resolve({version: latestVersion, delta: delta});
    }

    // Force the `_changeCondition` to `false` (though it might already be
    // so set; innocuous if so), and wait for it to become `true`.
    this._changeCondition.value = false;
    return this._changeCondition.whenTrue().then((v) => {
      // Just recurse to do the work. Under normal circumstances it will return
      // promptly. This arrangement gracefully handles edge cases, though, such
      // as a triggered change turning out to be due to a no-op.
      return this.deltaAfter(baseVersion);
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
   * @param baseVersion Version number which `delta` is with respect to.
   * @param delta Delta indicating what has changed with respect to
   *   `baseVersion`.
   * @returns Object that binds `version` to the new version number and `delta`
   *   to a delta _with respect to the implied expected result_ which can be
   *   used to get the new document state.
   */
  applyDelta(baseVersion, delta) {
    baseVersion = this._versionNumber(baseVersion, false);

    if (baseVersion === this.latestVersion) {
      // The easy case: Apply a delta to the latest version (unless it's empty,
      // in which case we don't have to make a new version at all; that's
      // handled by `_appendDelta()`).
      this._appendDelta(delta);
      return {
        delta: [], // That is, there was no correction.
        version: this.latestVersion // `_appendDelta()` updates the version.
      }
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a version of the document which is _not_
    // the latest version (hereafter, `vBase` for the common base and `vLatest`
    // for the latest version). Here's what we do:
    //
    // 1. Construct a combined delta for all the server changes made between
    //    `vBase` and `vLatest`. This is `dServer`.
    // 2. Transform (rebase) `dClient` with regard to (on top of) `dServer`.
    //    This is `dNext`. If `dNext` turns out to be empty, stop here and
    //    report that fact.
    // 3. Apply `dNext` to `vLatest`, producing `vNext` as the new latest server
    //    version.
    // 4. Apply `dClient` to `vBase` to produce `vExpected`, that is, the result
    //    that the client would have expected in the easy case. Construct a
    //    delta from `vExpected` to `vNext` (that is, the diff). This is
    //    `dCorrection`. This is what we return to the client; they will compose
    //    `vExpected` with `dCorrection` to arrive at `vNext`.

    // Assign variables from parameter and instance variables that correspond
    // to the description immediately above.
    const dClient    = delta;
    const vBaseNum   = baseVersion;
    const vBase      = this.snapshot(vBaseNum).data;
    const vLatestNum = this.latestVersion;

    // (1)
    const dServer = this._composeVersions(vBaseNum + 1);

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = dServer.transform(dClient, true);

    if (DeltaUtil.isEmpty(dNext)) {
      return {
        delta: [], // That is, there was no correction.
        version: this.latestVersion
      }
    }

    // (3)
    this._appendDelta(dNext);
    const vNext = this.snapshot().data; // This lets the snapshot get cached.

    // (4)
    const vExpected = DeltaUtil.coerce(vBase).compose(dClient);
    const dCorrection = vExpected.diff(vNext);

    return {
      delta: dCorrection,
      version: this.latestVersion
    }
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial version (inclusive) through the given final version
   * (exclusive). It is valid for the range to be empty, in which case this
   * returns an empty delta. It is invalid for the start and end to be
   * inverted (that is, `end < start`). It is also invalid for the range to
   * include non-existent versions (negative or too large).
   *
   * @param startInclusive Version number for the first delta to include in the
   *   result.
   * @param endExclusive (optional) Version number for just after the last delta
   *   to include, or alternatively thought, of the first version to exclude
   *   from the result. If not passed, defaults to `nextVersion`, that is, the
   *   version just past the latest version.
   * @returns The composed delta consisting of versions `startInclusive`
   *   through but not including `endExclusive`.
   */
  _composeVersions(startInclusive, endExclusive = this.nextVersion) {
    // Validate parameters.
    if (startInclusive < 0) {
      throw new Error('startInclusive < 0');
    } else if (endExclusive < startInclusive) {
      throw new Error('endExclusive < startInclusive');
    } else if (endExclusive > this._changes.length) {
      throw new Error('endExclusive > this.nextVersion');
    }

    if (startInclusive === endExclusive) {
      return DeltaUtil.EMPTY_DELTA;
    }

    let result = this._changes[startInclusive];
    for (let i = startInclusive + 1; i < endExclusive; i++) {
      result = result.compose(this._changes[i]);
    }

    return result;
  }

  /**
   * Appends a new delta to the document. Also forces `_changeCondition`
   * `true` to release any waiters.
   *
   * **Note:** If the delta is a no-op, then this method does nothing.
   *
   * @param delta The delta to append.
   */
  _appendDelta(delta) {
    if (DeltaUtil.isEmpty(delta)) {
      return;
    }

    this._changes.push(DeltaUtil.coerce(delta));
    this._changeCondition.value = true;
  }

  /**
   * Checks a version number for sanity. Throws an error when insane.
   *
   * @param version the (alleged) version number to check
   * @param wantLatest if `true` indicates that `undefined` should be treated as
   * a request for the latest version. If `false`, `undefined` is an error.
   * @returns the version number
   */
  _versionNumber(version, wantLatest) {
    if (wantLatest && (version === undefined)) {
      return this.latestVersion;
    }

    if (   (typeof version !== 'number')
        || (version !== Math.floor(version))
        || (version < 0)
        || (version > this.latestVersion)) {
      throw new Error(`Bad version number: ${version}`);
    }

    return version;
  }
}
