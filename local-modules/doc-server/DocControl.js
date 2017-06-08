// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DeltaResult, DocumentChange, FrozenDelta, Snapshot, Timestamp, VersionNumber }
  from 'doc-common';
import { BaseDoc, Coder } from 'doc-store';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase, PromCondition, PromDelay } from 'util-common';

import Paths from './Paths';

/** {Logger} Logger for this module. */
const log = new Logger('doc-control');

/** {number} Initial amount of time (in msec) between append retries. */
const INITIAL_APPEND_RETRY_MSEC = 50;

/** {number} Growth factor for append retry delays. */
const APPEND_RETRY_GROWTH_FACTOR = 5;

/**
 * {number} Maximum amount of time to spend (in msec) retrying append
 * operations.
 */
const MAX_APPEND_TIME_MSEC = 20 * 1000; // 20 seconds.

/**
 * Controller for a given document. There is only ever exactly one instance of
 * this class per document, no matter how many active editors there are on that
 * document. (This guarantee is provided by `DocServer`.)
 */
export default class DocControl extends CommonBase {
  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_ERROR() {
    return 'status_error';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_MIGRATE() {
    return 'status_migrate';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_NOT_FOUND() {
    return 'status_not_found';
  }

  /** {string} Return value from `validationStatus()`, see which for details. */
  static get STATUS_OK() {
    return 'status_ok';
  }

  /**
   * Constructs an instance.
   *
   * @param {BaseDoc} docStorage The underlying document storage.
   * @param {FrozenBuffer} formatVersion Format version to expect and use.
   */
  constructor(docStorage, formatVersion) {
    super();

    /** {BaseDoc} Storage access for the document. */
    this._doc = BaseDoc.check(docStorage);

    /** {FrozenBuffer} The document format version to expect and use. */
    this._formatVersion = formatVersion;

    /**
     * {Map<VersionNumber,Snapshot>} Mapping from version numbers to
     * corresponding document snapshots. Sparse.
     */
    this._snapshots = new Map();

    /**
     * Condition that transitions from `false` to `true` when there is a version
     * change and there are waiters for same. This remains `true` in the steady
     * state (when there are no waiters). As soon as the first waiter comes
     * along, it gets set to `false`.
     */
    this._changeCondition = new PromCondition(true);

    /** {Logger} Logger specific to this document's ID. */
    this._log = log.withPrefix(`[${this._doc.id}]`);

    this._log.detail('Constructed.');
  }

  /** {string} The ID of the document that this instance represents. */
  get id() {
    return this._doc.id;
  }

  /**
   * Creates or re-creates the document. If passed, the given `delta` becomes
   * the initial content of the document (which will be in the second change,
   * because by definition the first change of a document is empty).
   *
   * @param {FrozenDelta|null} [contents = null] Initial document contents, or
   *   `null` if the document should be completely empty.
   */
  async create(contents = null) {
    if (contents !== null) {
      FrozenDelta.check(contents);
    }

    this._log.info('Creating document.');

    await this._doc.create();
    await this._doc.opNew(Paths.FORMAT_VERSION, this._formatVersion);

    // Empty first change (per documented interface).
    await this._doc.opNew(Paths.forVerNum(0), Coder.encode(DocumentChange.firstChange()));

    // The indicated `contents`, if any.
    if (contents !== null) {
      const change = new DocumentChange(1, Timestamp.now(), contents, null);
      await this._doc.opNew(Paths.forVerNum(1), Coder.encode(change));
    }

    const verNum = (contents === null) ? 0 : 1;
    await this._doc.opNew(Paths.VERSION_NUMBER, Coder.encode(verNum));
  }

  /**
   * Gets a particular change to the document. The document consists of a
   * sequence of changes, each modifying version N of the document to produce
   * version N+1.
   *
   * @param {Int} verNum The version number of the change. The result is the
   *   change which produced that version. E.g., `0` is a request for the first
   *   change (the change from the empty document).
   * @returns {DocumentChange} The requested change.
   */
  async change(verNum) {
    return this._changeRead(verNum);
  }

  /**
   * Gets a snapshot of the full document contents.
   *
   * @param {Int|null} verNum Which version to get. If passed as `null`,
   *   indicates the latest (most recent) version.
   * @returns {Snapshot} The corresponding snapshot.
   */
  async snapshot(verNum = null) {
    const currentVerNum = await this._currentVerNum();
    verNum = (verNum === null)
      ? currentVerNum
      : VersionNumber.maxInc(verNum, currentVerNum);

    // Search backward through the full versions for a base for forward
    // composition.
    let base = null;
    for (let i = verNum; i >= 0; i--) {
      const v = this._snapshots.get(i);
      if (v) {
        base = v;
        break;
      }
    }

    if (base && (base.verNum === verNum)) {
      // Found the right version!
      return base;
    }

    // We didn't actully find a snapshot of the requested version. Apply deltas
    // to the base to produce the desired version. Store it, and return it.

    const contents = (base === null)
      ? this._composeVersions(FrozenDelta.EMPTY, 0,               verNum + 1)
      : this._composeVersions(base.contents,     base.verNum + 1, verNum + 1);
    const result = new Snapshot(verNum, await contents);

    this._log.detail(`Made snapshot for version ${verNum}.`);

    this._snapshots.set(verNum, result);
    return result;
  }

  /**
   * Evaluates the condition of the document, reporting a "validation status."
   * The return value is one of the `STATUS_*` constants defined by this class:
   *
   * * `STATUS_OK` &mdash; No problems.
   * * `STATUS_MIGRATE` &mdash; Document is in a format that is not understood.
   * * `STATUS_NOT_FOUND` &mdash; The document doesn't exist.
   * * `STATUS_ERROR` &mdash; Document is in an unrecoverably-bad state.
   *
   * This method will also emit information to the log about problems.
   *
   * @returns {string} The validation status.
   */
  async validationStatus() {
    if (!(await this._doc.exists())) {
      return DocControl.STATUS_NOT_FOUND;
    }

    const formatVersion =
      await this._doc.pathReadOrNull(Paths.FORMAT_VERSION);

    if (formatVersion === null) {
      this._log.info('Corrupt document: Missing format version.');
      return DocControl.STATUS_ERROR;
    }

    if (!formatVersion.equals(this._formatVersion)) {
      const got = formatVersion.string;
      const expected = this._formatVersion.string;
      this._log.info(`Mismatched format version: got ${got}; expected ${expected}`);
      return DocControl.STATUS_MIGRATE;
    }

    const verNumEncoded =
      await this._doc.pathReadOrNull(Paths.VERSION_NUMBER);

    if (verNumEncoded === null) {
      this._log.info('Corrupt document: Missing version number.');
      return DocControl.STATUS_ERROR;
    }

    let verNum;
    try {
      verNum = Coder.decode(verNumEncoded);
    } catch (e) {
      this._log.info('Corrupt document: Bogus version number.');
      return DocControl.STATUS_ERROR;
    }

    for (let i = 0; i <= verNum; i++) {
      try {
        this._changeRead(i);
      } catch (e) {
        this._log.info(`Corrupt document: Bogus change #${i}.`);
        return DocControl.STATUS_ERROR;
      }
    }

    return DocControl.STATUS_OK;
  }

  /**
   * Returns a promise for a version &mdash; any version &mdash; of the document
   * after the given `baseVerNum`, with the return result represented as a delta
   * relative to that given version. If called when `baseVerNum` is the current
   * version, this will not resolve the result promise until at least one change
   * has been made.
   *
   * @param {Int} baseVerNum Version number for the document.
   * @returns {DeltaResult} Delta and associated version number. The result's
   *   `verNum` is guaranteed to be at least one more than `baseVerNum` (and
   *   could possibly be even larger.) The result's `delta` can be applied to
   *   version `baseVerNum` to produce version `verNum` of the document.
   */
  async deltaAfter(baseVerNum) {
    const currentVerNum = await this._currentVerNum();
    VersionNumber.maxInc(baseVerNum, currentVerNum);

    if (baseVerNum !== currentVerNum) {
      // We can fulfill the result based on existing document history. (That is,
      // we don't have to wait for a new change to be added to the document).
      // Compose all the deltas from the version after the base through the
      // current version.
      const delta = await this._composeVersions(
        FrozenDelta.EMPTY, baseVerNum + 1, VersionNumber.after(currentVerNum));
      return new DeltaResult(currentVerNum, delta);
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
   * As a special case, as long as `baseVerNum` is valid, if `delta` is empty,
   * this method returns a result of the same version number along with an
   * empty "correction" delta. That is, the return value from passing an empty
   * delta doesn't provide any information about subsequent versions of the
   * document.
   *
   * @param {Int} baseVerNum Version number which `delta` is with respect to.
   * @param {FrozenDelta} delta Delta indicating what has changed with respect
   *   to `baseVerNum`.
   * @param {string|null} authorId Author of `delta`, or `null` if the change
   *   is to be considered authorless.
   * @returns {DeltaResult} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The promise resolves sometime after the
   *   delta has been applied to the document.
   */
  async applyDelta(baseVerNum, delta, authorId) {
    // Very basic argument validation. Once in the guts of the thing, we will
    // discover (and properly complain) if there are deeper problems with them.
    FrozenDelta.check(delta);
    TString.orNull(authorId);

    // Snapshot of the base version. This call validates `baseVerNum`.
    const base = await this.snapshot(baseVerNum);

    // Check for an empty `delta`. If it is, we don't bother trying to apply it.
    // See method header comment for more info.
    if (delta.isEmpty()) {
      return new DeltaResult(baseVerNum, FrozenDelta.EMPTY);
    }

    // Compose the implied expected result. This has the effect of validating
    // the contents of `delta`.
    const expected = new Snapshot(
      VersionNumber.after(baseVerNum),
      base.contents.compose(delta));

    // We try performing the apply, and then we iterate if it failed _and_ the
    // reason is simply that there were any changes that got made while we were
    // in the middle of the attempt. Any other problems are transparently thrown
    // to the caller.
    let retryDelayMsec = INITIAL_APPEND_RETRY_MSEC;
    let retryTotalMsec = 0;
    let attemptCount = 0;
    for (;;) {
      attemptCount++;
      if (attemptCount !== 1) {
        this._log.info(`Append attempt #${attemptCount}.`);
      }

      const current = await this.snapshot();
      const result =
        await this._applyDeltaTo(base, delta, authorId, current, expected);

      if (result !== null) {
        return result;
      }

      // A `null` result from the call means that we lost an append race (that
      // is, there was version skew between the snapshot and the latest reality
      // at the moment of attempted appending), so we delay briefly and iterate.

      if (retryTotalMsec >= MAX_APPEND_TIME_MSEC) {
        // ...except if these attempts have taken wayyyy too long. If we land
        // here, it's probably due to a bug (but not a total given).
        throw new Error('Too many failed attempts in `applyDelta()`.');
      }

      this._log.info(`Sleeping ${retryDelayMsec} msec.`);
      await PromDelay.resolve(retryDelayMsec);
      retryTotalMsec += retryDelayMsec;
      retryDelayMsec *= APPEND_RETRY_GROWTH_FACTOR;
    }
  }

  /**
   * Main implementation of `applyDelta()`, which takes as an additional
   * argument a promise for a snapshot which represents the current (latest)
   * version at the moment it resolves. This method attempts to perform change
   * application relative to that snapshot. If it succeeds (that is, if the
   * snapshot is still current at the moment of attempted application), then
   * this method returns a proper result of `applyDelta()`. If it fails due to
   * the snapshot being out-of-date, then this method returns `null`. All other
   * problems are reported by throwing an exception.
   *
   * @param {Snapshot} base Snapshot of the base from which the delta is
   *   defined. That is, this is the snapshot of `baseVerNum` as provided to
   *   `applyDelta()`.
   * @param {FrozenDelta} delta Same as for `applyDelta()`.
   * @param {string|null} authorId Same as for `applyDelta()`.
   * @param {Snapshot} current Snapshot of the current (latest) version of the
   *   document.
   * @param {Snapshot} expected The implied expected result as defined by
   *   `applyDelta()`.
   * @returns {DeltaResult|null} Result for the outer call to `applyDelta()`,
   *   or `null` if the application failed due to an out-of-date `snapshot`.
   */
  async _applyDeltaTo(base, delta, authorId, current, expected) {
    if (base.verNum === current.verNum) {
      // The easy case, because the base version is in fact the current version
      // of the document, so we don't have to transform the incoming delta.
      // We merely have to apply the given `delta` to the current version. If
      // it succeeds, then we won the append race (if any).

      const verNum = await this._appendDelta(base.verNum, delta, authorId);

      if (verNum === null) {
        // Turns out we lost an append race.
        return null;
      }

      return new DeltaResult(verNum, FrozenDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a version of the document which is _not_
    // the current version (hereafter, `vBase` for the common base and
    // `vCurrent` for the current version). Here's what we do:
    //
    // 0. Definitions of input:
    //    * `dClient` -- Delta to apply, as requested by the client.
    //    * `vBase` -- Base version to apply the delta to.
    //    * `vCurrent` -- Current (latest) version of the document.
    //    * `vExpected` -- The implied expected result of application. This is
    //      `vBase.compose(dClient)` as version number `vBase.verNum + 1`.
    // 1. Construct a combined delta for all the server changes made between
    //    `vBase` and `vCurrent`. This is `dServer`.
    // 2. Transform (rebase) `dClient` with regard to (on top of) `dServer`.
    //    This is `dNext`. If `dNext` turns out to be empty, stop here and
    //    report that fact.
    // 3. Apply `dNext` to `vCurrent`, producing `vNext` as the new current
    //    server version.
    // 4. Construct a delta from `vExpected` to `vNext` (that is, the diff).
    //    This is `dCorrection`. This is what we return to the client; they will
    //    compose `vExpected` with `dCorrection` to arrive at `vNext`.
    // 5. Return the version number of `vNext` along with the delta
    //    `dCorrection`.

    // (0) Assign incoming arguments to variables that correspond to the
    //     description immediately above.
    const dClient   = delta;
    const vBase     = base;
    const vExpected = expected;
    const vCurrent  = current;

    // (1)
    const dServer = await this._composeVersions(
      FrozenDelta.EMPTY, vBase.verNum + 1, VersionNumber.after(vCurrent.verNum));

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = FrozenDelta.coerce(dServer.transform(dClient, true));

    if (dNext.isEmpty()) {
      // It turns out that nothing changed. **Note:** It is unclear whether this
      // can actually happen in practice, given that we already return early
      // (in `applyDelta()`) if we are asked to apply an empty delta.
      return new DeltaResult(vCurrent.verNum, FrozenDelta.EMPTY);
    }

    // (3)
    const vNextNum = await this._appendDelta(vCurrent.verNum, dNext, authorId);

    if (vNextNum === null) {
      // Turns out we lost an append race.
      return null;
    }

    const vNext = await this.snapshot(vNextNum);

    // (4)
    const dCorrection =
      FrozenDelta.coerce(vExpected.contents.diff(vNext.contents));

    // (5)
    return new DeltaResult(vNextNum, dCorrection);
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial version through and including the current latest delta,
   * composed from a given base. It is valid to pass as either version number
   * parameter one version beyond the current version number (that is,
   * `VersionNumber.after(await this._currentVerNum())`. It is invalid to
   * specify a non-existent version _other_ than one beyond the current version.
   * If `startInclusive === endExclusive`, then this method returns `baseDelta`.
   *
   * @param {FrozenDelta} baseDelta Base delta onto which the indicated deltas
   *   get composed.
   * @param {Int} startInclusive Version number for the first delta to include
   *   in the result.
   * @param {Int} endExclusive Version number just beyond the last delta to
   *   include in the result.
   * @returns {FrozenDelta} The composed delta consisting of `baseDelta`
   *   composed with versions `startInclusive` through but not including
   *   `endExclusive`.
   */
  async _composeVersions(baseDelta, startInclusive, endExclusive) {
    const nextVerNum = VersionNumber.after(await this._currentVerNum());
    startInclusive = VersionNumber.rangeInc(startInclusive, 0, nextVerNum);
    endExclusive =
      VersionNumber.rangeInc(endExclusive, startInclusive, nextVerNum);

    if (startInclusive === endExclusive) {
      // Trivial case: Nothing to compose.
      return baseDelta;
    }

    // First, request all the changes, and then compose them, in separate loops.
    // This arrangement means that it's possible for all of the change requests
    // to be serviced in parallel.

    const changePromises = [];
    for (let i = startInclusive; i < endExclusive; i++) {
      changePromises.push(this._changeRead(i));
    }

    const changes = await Promise.all(changePromises);
    const result = changes.reduce(
      (acc, change) => { return acc.compose(change.delta); },
      baseDelta);

    return FrozenDelta.coerce(result);
  }

  /**
   * Appends a new delta to the document. Also forces `_changeCondition`
   * `true` to release any waiters. On success, this returns the version number
   * of the document after the append. On a failure due to `baseVerNum` not
   * being current at the moment of application, this returns `null`. All other
   * errors are reported via thrown errors. See `_applyDeltaTo()` above for
   * further discussion.
   *
   * **Note:** If the delta is a no-op, then this method throws an error,
   * because the calling code should have handled that case without calling this
   * method.
   *
   * @param {Int} baseVerNum Version number which this is to apply to.
   * @param {FrozenDelta} delta The delta to append.
   * @param {string|null} authorId The author of the delta.
   * @returns {Int|null} The version number after appending `delta`, or `null`
   *   if `baseVerNum` is out-of-date at the moment of attempted application
   *   _and_ the `delta` is non-empty.
   */
  async _appendDelta(baseVerNum, delta, authorId) {
    if (delta.isEmpty()) {
      throw new Error('Should not have been called with an empty delta.');
    }

    const verNum = VersionNumber.after(baseVerNum);
    const change = new DocumentChange(verNum, Timestamp.now(), delta, authorId);
    const writeResult =
      await this._doc.opNew(Paths.forVerNum(verNum), Coder.encode(change));

    if (!writeResult) {
      // We lost an append race.
      this._log.info(`Lost append race for version ${verNum}.`);
      return null;
    }

    // Update the version number. **Note:** The `await` is to get errors to be
    // thrown via this method instead of being dropped on the floor.
    await this._writeVerNum(verNum);

    this._changeCondition.value = true;
    return verNum;
  }

  /**
   * Reads the change for the indicated version number. It is an error to
   * request a change that doesn't exist.
   *
   * @param {VersionNumber} verNum Version number of the change. This indicates
   *   the change that produced that document version.
   * @returns {DocumentChange} The corresponding change.
   */
  async _changeRead(verNum) {
    const encoded = await this._doc.pathRead(Paths.forVerNum(verNum));
    return DocumentChange.check(Coder.decode(encoded));
  }

  /**
   * Gets the current document version number.
   *
   * @returns {VersionNumber|null} The version number, or `null` if it is not
   *   set.
   */
  async _currentVerNum() {
    const encoded = await this._doc.pathReadOrNull(Paths.VERSION_NUMBER);
    return (encoded === null) ? null : Coder.decode(encoded);
  }

  /**
   * Writes the given value as the current document version number.
   *
   * @param {VersionNumber} verNum The version number.
   * @returns {boolean} `true` once the write is complete.
   */
  async _writeVerNum(verNum) {
    VersionNumber.check(verNum);

    await this._doc.opForceWrite(Paths.VERSION_NUMBER, Coder.encode(verNum));
    return true;
  }
}
