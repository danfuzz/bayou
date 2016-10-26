// Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import Delta from 'quill-delta';

import Condition from './Condition';
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
    this._changeCondition = new Condition(true);

    // Initialize the document with static content (for now).
    const firstVersion = new Delta(default_document);
    this._changes.push(firstVersion);
  }

  /**
   * The version number corresponding to the current (latest) version of the
   * document.
   */
  get currentVersion() {
    return this._changes.length - 1;
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
    baseVersion = this._versionNumber(baseVersion, false);

    if (baseVersion !== this.currentVersion) {
      // We can fulfill the result immediately. Compose all the deltas from
      // the version after the base through the current version.
      const currentVersion = this.currentVersion;
      let delta = this._changes[baseVersion + 1];
      for (let i = baseVersion + 2; i <= currentVersion; i++) {
        delta = delta.compose(this._changes[i]);
      }

      // We don't just return a plain value (that is, we still return a promise)
      // because of the usual hygenic recommendation to always return either
      // an immediate result or a promise from any given function.
      return Promise.resolve({ version: currentVersion, delta: delta });
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

    if (baseVersion === this.currentVersion) {
      // The easy case: Apply a delta to the latest version (unless it's empty,
      // in which case we don't have to make a new version at all).
      this._appendDelta(delta);
      return {
        delta: [], // That is, there was nothing else to merge.
        version: this.currentVersion
      }
    }

    // TODO: Handle merge. This is going to involve calling `Delta.transform()`
    // with further details TBD.
    throw new Error('Can\'t deal with merge...yet.');
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
    if (delta.length === 0) {
      return;
    }

    this._changes.push(new Delta(delta));
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
      return this.currentVersion;
    }

    if (   (typeof version !== 'number')
        || (version !== Math.floor(version))
        || (version < 0)
        || (version > this.currentVersion)) {
      throw new Error(`Bad version number: ${version}`);
    }

    return version;
  }
}
