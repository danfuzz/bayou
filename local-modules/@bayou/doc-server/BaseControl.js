// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Timeouts } from '@bayou/doc-common';
import { Errors as fileStoreOt_Errors, StoragePath, FileOp, FileChange } from '@bayou/file-store-ot';
import { BaseSnapshot, RevisionNumber } from '@bayou/ot-common';
import { Delay } from '@bayou/promise-util';
import { TBoolean, TFunction } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import BaseDataManager from './BaseDataManager';
import ValidationStatus from './ValidationStatus';

/** {Int} Initial amount of time (in msec) between update retries. */
const INITIAL_UPDATE_RETRY_MSEC = 50;

/** {Int} Growth factor for update retry delays. */
const UPDATE_RETRY_GROWTH_FACTOR = 5;

/** {Int} Maximum amount of time (in msec) between update retries. */
const MAX_UPDATE_RETRY_MSEC = 15 * 1000;

/**
 * {Int} Maximum number of document changes to read in a single iteration over
 * changes. (The idea is to avoid doing so much processing that the main Node
 * event loop chokes up.)
 */
const MAX_CHANGE_READS_PER_ITERATION = 1000;

/**
 * {Int} Maximum number of changes to compose in order to produce a result from
 * {@link BaseControl#getDiff}. Asking for more will result in the method doing
 * a snapshot diff.
 */
const MAX_COMPOSED_CHANGES_FOR_DIFF = 100;

/**
 * {Int} How many changes to wait before writing a new stored snapshot. Stored
 * snapshots will always have a revision number that is an integral multiple of
 * this value.
 */
const CHANGES_PER_STORED_SNAPSHOT = 100;

/**
 * Base class for document part controllers. There is one instance of each
 * concrete subclass of this class for each actively-edited document. They are
 * all managed and hooked up via {@link FileComplex}.
 *
 * This class has two direct subclasses, which are both abstract,
 * {@link DurableControl} and {@link EphemeralControl}. The only difference
 * in behavior between the subclasses is in whether full change history is
 * stored. See their descriptions for details.
 */
export default class BaseControl extends BaseDataManager {
  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get changeClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return this.snapshotClass.changeClass;
  }

  /**
   * {string} `StoragePath` prefix string for all changes stored for the portion
   * of the document controlled by this class.
   */
  static get changePathPrefix() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return `${this.pathPrefix}/change`;
  }

  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class.
   */
  static get deltaClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return this.snapshotClass.deltaClass;
  }

  /**
   * {boolean} Whether (`true`) or not (`false`) this instance controls an
   * ephemeral part. This is overridden in each of the two direct subclasses of
   * this class and should not be overridden further.
   *
   * @abstract
   */
  static get ephemeral() {
    throw this._mustOverride();
  }

  /**
   * {string} Path prefix to use for file storage for the portion of the
   * document controlled by instances of this class.
   */
  static get pathPrefix() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._pathPrefix) {
      // Call the `_impl` and verify the result.
      const prefix = this._impl_pathPrefix;

      StoragePath.check(prefix);
      this._pathPrefix = prefix;
    }

    return this._pathPrefix;
  }

  /**
   * {string} `StoragePath` string which stores the current revision number for
   * the portion of the document controlled by this class. This corresponds to
   * the change number for the most recent change stored in the document.
   */
  static get revisionNumberPath() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return `${this.pathPrefix}/revision_number`;
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class.
   */
  static get snapshotClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._snapshotClass) {
      // Call the `_impl` and verify the result.
      const clazz = this._impl_snapshotClass;

      TFunction.checkClass(clazz, BaseSnapshot);
      this._snapshotClass = clazz;
    }

    return this._snapshotClass;
  }

  /**
   * {string} `StoragePath` string which stores the base snapshot for the
   * portion of the document controlled by this class.
   */
  static get storedSnapshotPath() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return `${this.pathPrefix}/snapshot`;
  }

  /**
   * Gets the `StoragePath` string corresponding to the indicated revision
   * number, specifically for the portion of the document controlled by this
   * class.
   *
   * @param {RevisionNumber} revNum The revision number.
   * @returns {string} The corresponding `StoragePath` string.
   */
  static pathForChange(revNum) {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    RevisionNumber.check(revNum);
    return `${this.changePathPrefix}/${revNum}`;
  }

  /**
   * Appends a new change to the document. On success, this returns `true`. On a
   * failure due to `baseRevNum` not being current at the moment of application,
   * this returns `false`. All other failures are reported via thrown errors.
   *
   * **Note:** This method trusts the `change` to be valid. As such, it is _not_
   * appropriate to expose this method directly to client access.
   *
   * **Note:** If the change is a no-op, then this method throws an error,
   * because the calling code should have handled that case without calling this
   * method.
   *
   * @param {BaseChange} change Change to append. Must be an instance of the
   *   appropriate subclass of `BaseChange` for this instance.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {boolean} Success flag. `true` indicates that the change was
   *   appended. `false` indicates that it was unsuccessful specifically because
   *   it lost an append race (that is, revision `change.revNum` already exists
   *   at the moment of the write attempt).
   * @throws {Error} If `change.delta.isEmpty()`.
   */
  async appendChange(change, timeoutMsec = null) {
    const file = this.fileCodec.file;
    const codec = this.fileCodec.codec;
    const clazz = this.constructor;
    clazz.changeClass.check(change);

    if (change.delta.isEmpty()) {
      throw Errors.badValue(change, clazz.changeClass, 'non-empty');
    }

    const revNum             = change.revNum;
    const baseRevNum         = revNum - 1;
    const changePath         = clazz.pathForChange(revNum);
    const revisionPath       = clazz.revisionNumberPath;
    const clampedTimeoutMsec = Timeouts.clamp(timeoutMsec);

    const fileOps = [
      FileOp.op_writePath(changePath, codec.encodeJsonBuffer(change)),
      FileOp.op_writePath(revisionPath, codec.encodeJsonBuffer(revNum))
    ];

    const snapshot   = await file.getSnapshot();
    const fileChange = new FileChange(snapshot.revNum + 1, fileOps);

    try {
      // Run prerequisites on snapshot
      snapshot.checkPathIs(revisionPath, codec.encodeJsonBuffer(baseRevNum));
      snapshot.checkPathAbsent(changePath);
      await file.appendChange(fileChange, clampedTimeoutMsec);
    } catch (e) {
      if (fileStoreOt_Errors.is_pathNotAbsent(e) || fileStoreOt_Errors.is_pathHashMismatch(e)) {
        const errorName = fileStoreOt_Errors.is_pathNotAbsent(e) ? 'pathNotAbsent' : 'pathHashMismatch';
        // One of these will get thrown if and when we lose an append race. This
        // regularly occurs when there are simultaneous editors.
        this.log.info(`Lost document append race for revision with ${errorName} for revNum ${revNum}`);

        if (fileStoreOt_Errors.is_pathNotAbsent(e)) {
          const resultFromPath = snapshot.getOrNull(changePath);
          const decodedResultFromPath =
            resultFromPath !== null ? codec.decodeJsonBuffer(resultFromPath) : resultFromPath;
          this.log.info('Path not absent when it should be:', decodedResultFromPath);
        }

        return false;
      } else if (Errors.is_timedOut(e)) {
        this.log.info(`\`appendChange()\` timed out: ${timeoutMsec}msec`);
        throw Errors.timedOut(timeoutMsec);
      } else {
        // No other errors are expected, so just rethrow.
        throw e;
      }
    }

    // We don't `await` this call, because the method performs its own error
    // handling. It is really a fairly independent operation, which just happens
    // to be triggered here.
    this._maybeWriteStoredSnapshot(change.revNum);

    return true;
  }

  /**
   * Gets the instantaneously-current revision number of the portion of the file
   * controlled by this instance. It is an error to call this on an
   * uninitialized document (e.g., when the underlying file is empty).
   *
   * **Note:** Due to the asynchronous nature of the system, the value returned
   * here could be out-of-date by the time it is received by the caller. As
   * such, even when used promptly, it should not be treated as "definitely
   * current" but more like "probably current but possibly just a lower bound."
   *
   * **Note:** Currently, this function is practically synchronous,
   * but has been kept `async` and takes an (unused) timeout in anticipation
   * of a future state where it will deal with data that it has to page in.
   *
   * @param {Int|null} [timeoutMsec_unused = null] Maximum amount of time to
   *   allow in this call, in msec. This value will be silently clamped to the
   *   allowable range as defined by {@link Timeouts}. `null` is treated as the
   *   maximum allowed value.
   * @returns {Int} The instantaneously-current revision number.
   */
  async currentRevNum(timeoutMsec_unused = null) {
    const { file, codec }   = this.fileCodec;
    const clazz             = this.constructor;
    const revNumStoragePath = clazz.revisionNumberPath;
    const fileSnapshot      = await file.getSnapshot();

    fileSnapshot.checkPathPresent(revNumStoragePath);

    const encodedRevNum = fileSnapshot.get(revNumStoragePath);
    const revNum = codec.decodeJsonBuffer(encodedRevNum);

    return RevisionNumber.check(revNum);
  }

  /**
   * Gets a particular change to the part of the document that this instance
   * controls. It is an error to request a revision that does not yet exist. For
   * subclasses that don't keep full history, it is also an error to
   * request a revision that is _no longer_ available; in this case, the error
   * name is always `revisionNotAvailable`.
   *
   * @param {Int} revNum The revision number of the change. The result is the
   *   change which produced that revision. E.g., `0` is a request for the first
   *   change (the change from the empty document).
   * @returns {BodyChange} The requested change.
   */
  async getChange(revNum) {
    RevisionNumber.check(revNum); // So we know we can `+1` without weirdness.
    const changes = await this._getChangeRange(revNum, revNum + 1, true);

    if (changes.length === 0) {
      throw Errors.revisionNotAvailable(revNum);
    }

    return changes[0];
  }

  /**
   * Returns a document change representing a change to the portion of the file
   * controlled by this instance which has been made with respect to a given
   * revision. This returns a promptly-resolved value when `baseRevNum` is not
   * the current revision (that is, it is an older revision); but when
   * `baseRevNum` _is_ the current revision, the return value only resolves
   * after at least one change has been made. It is an error to request a
   * base revision that does not yet exist. For subclasses that don't keep full
   * history, it is also an error to request a revision that is _no longer_
   * available as a base; in this case, the error name is always
   * `revisionNotAvailable`.
   *
   * The return value is a change instance with respect to (that is, whose base
   * revision is) the one indicated by `baseRevNum` as passed to the method.
   * That is, roughly speaking, if `snapshot[result.revNum] =
   * snapshot(baseRevNum).compose(result)`.
   *
   * @param {Int} baseRevNum Revision number for the base to get a change with
   *   respect to. Must be no greater than the current revision number at the
   *   time of the call.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {BaseChange} Change with respect to the revision indicated by
   *   `baseRevNum`. Always an instance of the appropriate change class as
   *   specified by the concrete subclass of this class. The result's `revNum`
   *   is guaranteed to be at least one greater than `baseRevNum` (and could
   *   possibly be even larger). The `timestamp` and `authorId` of the result
   *   will both be `null`.
   * @throws {Errors.timedOut} Thrown if the timeout time is reached befor a
   *   change becomes available.
   */
  async getChangeAfter(baseRevNum, timeoutMsec = null) {
    timeoutMsec = Timeouts.clamp(timeoutMsec);
    let currentRevNum = await this.currentRevNum();
    RevisionNumber.maxInc(baseRevNum, currentRevNum);

    if (currentRevNum === baseRevNum) {
      // There is not yet a change after the requested base, so wait for it to
      // exist.
      currentRevNum = await this.whenRevNum(baseRevNum + 1, timeoutMsec);
    }

    return this.getDiff(baseRevNum, currentRevNum);
  }

  /**
   * Constructs a delta consisting of the given base delta composed with the
   * deltas of the changes from the given initial revision through but not
   * including the indicated end revision. It is valid to pass as either
   * revision number parameter one revision beyond the current document revision
   * number (that is, `(await this.currentRevNum()) + 1`. It is invalid to
   * specify a non-existent revision _other_ than one beyond the current
   * revision. If `startInclusive === endExclusive`, then this method returns
   * `baseDelta`. For subclasses that don't keep full change history, it is also
   * an error to request a change that is _no longer_  available; in this case,
   * the error name is always `revisionNotAvailable`.
   *
   * @param {BaseDelta} baseDelta Base delta onto which the indicated deltas
   *   get composed. Must be an instance of the delta class appropriate to the
   *   concrete subclass being called.
   * @param {Int} startInclusive Revision number for the first change to include
   *   in the result.
   * @param {Int} endExclusive Revision number just beyond the last change to
   *   include in the result.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta. When `true`, `baseDelta` must be passed as a document
   *   delta. In addition, _some_ subclasses operate differently when asked to
   *   produce a document vs. not.
   * @returns {BaseDelta} The composed result consisting of `baseDelta` composed
   *   with the deltas of revisions `startInclusive` through but not including
   *  `endExclusive`.
   */
  async getComposedChanges(baseDelta, startInclusive, endExclusive, wantDocument) {
    const clazz = this.constructor;

    clazz.deltaClass.check(baseDelta);
    TBoolean.check(wantDocument);

    if (startInclusive === endExclusive) {
      // Trivial case: Nothing to compose. If we were to have made it to the
      // loop below, `_getChangeRange()` and `compose()` would have taken care
      // of the salient error checking. But because we're short-circuiting out
      // of it here, we need to explicitly check argument validity.

      if (wantDocument && !baseDelta.isDocument()) {
        throw Errors.badValue(baseDelta, 'document delta');
      }

      await this._getChangeRange(startInclusive, startInclusive, false);
      return baseDelta;
    }

    let result = baseDelta;
    const MAX = MAX_CHANGE_READS_PER_ITERATION;
    for (let i = startInclusive; i < endExclusive; i += MAX) {
      const end     = Math.min(i + MAX, endExclusive);
      const changes = await this._getChangeRange(i, end, false);
      const deltas  = changes.map(c => c.delta);

      result = result.composeAll(deltas, wantDocument);
    }

    return result;
  }

  /**
   * Gets a change which represents the difference between two specified
   * revisions. The result is guaranteed to be appropriate for production of
   * the newer revision from the older one by calling
   * `baseSnapshot.compose(result)`. No other guarantees are made about the
   * result. More specifically, there are two possible ways that the result is
   * produced:
   *
   * * By composing all the changes from `baseRevNum + 1` through and including
   *   `newerRevNum`.
   * * By constructing an OT `diff` directly based on snapshots of the two
   *   revisions.
   *
   * These two tactics, while producing equally valid results, do not always
   * produce results that are identical to each other.
   *
   * **Note:** The current implementation uses a fairly simple heuristic to
   * decide which tactic to use. However, clients are advised not to count on
   * the happenstance of the heuristic to remain fixed over time.
   *
   * @param {Int} baseRevNum Revision number for the difference base.
   * @param {Int} newerRevNum Revision number for the difference target. Must be
   *   `> baseRevNum`.
   * @returns {BaseChange} Change instance which, when composed with the
   *   snapshot of the revision indicated by `baseRevNum`, results in the
   *   snapshot of the revision indicated by `newRevNum`.
   */
  async getDiff(baseRevNum, newerRevNum) {
    RevisionNumber.check(baseRevNum);
    RevisionNumber.min(newerRevNum, baseRevNum + 1);

    const clazz = this.constructor;

    if ((newerRevNum - baseRevNum) <= MAX_COMPOSED_CHANGES_FOR_DIFF) {
      // Few enough changes that composition will be a reasonably-fruitful way
      // to proceed.

      const delta = await this.getComposedChanges(
        clazz.deltaClass.EMPTY, baseRevNum + 1, newerRevNum + 1, false);

      return new clazz.changeClass(newerRevNum, delta);
    } else {
      // Too many changes to expect composition to be the most efficient way.
      // Instead, diff the snapshots directly.

      const [baseSnapshot, newerSnapshot] = await Promise.all([
        this.getSnapshot(baseRevNum),
        this.getSnapshot(newerRevNum)
      ]);

      return baseSnapshot.diff(newerSnapshot);
    }
  }

  /**
   * Gets a snapshot of the full contents of the portion of the file controlled
   * by this instance. It is an error to request a revision that does not yet
   * exist. For subclasses that don't keep full history, it is also an error to
   * request a revision that is _no longer_ available; in this case, the error
   * name is always `revisionNotAvailable`.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the current (most recent) revision. **Note:** Due to
   *   the asynchronous nature of the system, when passed as `null` the
   *   resulting revision might already have been superseded by the time it is
   *   returned to the caller.
   * @returns {BaseSnapshot} Snapshot of the indicated revision. Always an
   *   instance of the concrete snapshot type appropriate for this instance.
   */
  async getSnapshot(revNum = null) {
    const currentRevNum = await this.currentRevNum();

    if (revNum === null) {
      this.log.info(`Getting most recent snapshot with revNum ${currentRevNum}`);
    }

    revNum = (revNum === null)
      ? currentRevNum
      : RevisionNumber.maxInc(revNum, currentRevNum);

    const result = await this._impl_getSnapshot(revNum);

    if (result === null) {
      throw Errors.revisionNotAvailable(revNum);
    }

    return this.constructor.snapshotClass.check(result);
  }

  /**
   * Gets a list of existing changes within a given range. The only changes that
   * exist both (a) have a revision number at or less than the
   * `currentRevNum()` and (b) have not been removed due to being ephemeral
   * data that has aged out. If given the same value for both arguments, this
   * method returns an empty array.
   *
   * **Note:** Currently, this function is practically synchronous,
   * but has been kept `async` and takes an (unused) timeout in anticipation
   * of a future state where it will deal with data that it has to page in.
   *
   * @param {Int} startInclusive Start change number (inclusive) of changes to
   *   read.
   * @param {Int} endExclusive End change number (exclusive) of changes to read.
   *   Must be `>= startInclusive`.
   * @param {Int|null} [timeoutMsec_unused = null] Maximum amount of time to
   *   allow in this call, in msec. This value will be silently clamped to the
   *   allowable range as defined by {@link Timeouts}. `null` is treated as the
   *   maximum allowed value.
   * @returns {array<Int>} Array of the revision numbers of existing changes, in
   *   order by revision number.
   */
  async listChangeRange(startInclusive, endExclusive, timeoutMsec_unused = null) {
    RevisionNumber.check(startInclusive);
    RevisionNumber.min(endExclusive, startInclusive);

    if (startInclusive === endExclusive) {
      // Per docs, this is valid and has an empty result.
      return [];
    }

    const snapshot = await this.fileCodec.file.getSnapshot();
    const prefix   = this.constructor.changePathPrefix;
    const paths    = snapshot.getPathRange(prefix, startInclusive, endExclusive);
    const result   = [];

    for (const path of paths.keys()) {
      result.push(StoragePath.getIndex(path));
    }

    result.sort();

    return result;
  }


  /**
   * Reads the stored snapshot for this document part, if available.
   *
   * **Note:** Currently, this function is practically synchronous,
   * but has been kept `async` and takes an (unused) timeout in anticipation
   * of a future state where it will deal with data that it has to page in.
   *
   * @param {Int|null} [timeoutMsec_unused = null] Maximum amount of time to
   *   allow in this call, in msec. This value will be silently clamped to the
   *   allowable range as defined by {@link Timeouts}. `null` is treated as the
   *   maximum allowed value.
   * @returns {BaseSnapshot|null} The stored snapshot, or `null` if no snapshot
   *   was ever stored.
   */
  async readStoredSnapshotOrNull(timeoutMsec_unused = null) {
    const clazz                 = this.constructor;
    const storedSnapshotPath    = clazz.storedSnapshotPath;
    const { file, codec }       = this.fileCodec;
    const fileSnapshot          = await file.getSnapshot();
    const encodedStoredSnapshot = fileSnapshot.getOrNull(storedSnapshotPath);

    if (encodedStoredSnapshot === null) {
      this.log.info('Failed to find stored snapshot.');

      return null;
    }

    const storedSnapshot = codec.decodeJsonBuffer(encodedStoredSnapshot);
    clazz.snapshotClass.check(storedSnapshot);
    this.log.info(`Read stored snapshot for revision: r${storedSnapshot.revNum}`);

    return storedSnapshot;
  }

  /**
   * Takes a change consisting of full information (except that the author ID
   * is optionally `null`), and applies it, including merging of any
   * intermediate revisions. The return value consists of a "correction" change
   * to be used to get the new latest document state. The correction is with
   * respect to the client's "expected result," that is to say, what the client
   * would get if the operations were applied with no intervening changes. So,
   * for example, if the change is able to be applied as exactly given, the
   * returned correction will have an empty `delta`.
   *
   * As a somewhat special case, if the `revNum` is valid and `delta` is empty,
   * this method returns an empty correction change with `revNum` being the
   * instantaneously-current revision number.
   *
   * **Note:** This method trusts the `authorId` and `timestamp`, and as such it
   * is _not_ appropriate to expose this method directly to client access.
   *
   * @param {BaseChange} change Change to apply. Must be an instance of the
   *   concrete change class as expected by this instance's class, and must
   *   have a `revNum` of at least `1`.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {BaseChange} The correction to the implied expected result of
   *   this operation. Will always be an instance of the appropriate concrete
   *   change class as defined by this instance's class. The `delta` of this
   *   result can be applied to the expected result to derive the revision
   *   indicated by the result's `revNum`. The `timestamp` and `authorId` of the
   *   result will always be `null`.
   */
  async update(change, timeoutMsec = null) {
    const changeClass = this.constructor.changeClass;

    // This makes sure we have a surface-level proper instance, but doesn't
    // check for deeper problems (such as an invalid `revNum`). Once in the guts
    // of the operation, we will discover (and properly complain) if things are
    // amiss.
    changeClass.check(change);
    if (change.timestamp === null) {
      throw Errors.badValue(change, changeClass, 'timestamp !== null');
    }

    const baseRevNum = change.revNum - 1;

    if (baseRevNum < 0) {
      throw Errors.badValue(change, changeClass, 'revNum >= 1');
    }

    timeoutMsec = Timeouts.clamp(timeoutMsec);

    // Figure out when to time out. **Note:** This has to happen before the
    // first `await`!
    const timeoutTime = Date.now() + timeoutMsec;

    // Snapshot of the base revision. The `getSnapshot()` call effectively
    // validates `change.revNum` as a legit value for the current document
    // state.
    const baseSnapshot = await this.getSnapshot(baseRevNum);

    // Compose the implied expected result. This has the effect of validating
    // the contents of `delta`.

    // Original line:
    //   const expectedSnapshot = baseSnapshot.compose(change);
    // **TODO:** Remove the following extra-loggy version of the above once we
    // figure out why we're seeing errors.
    let expectedSnapshot;
    try {
      expectedSnapshot = baseSnapshot.compose(change);
    } catch (e) {
      this.log.event.badComposeChange(change);
      throw e;
    }

    // This makes sure we have syntactic and semantic validation for any change.
    // It will validate based on the subclass implementaton.
    this._impl_validateChange(change, baseSnapshot);

    // Try performing the update, and then iterate if it failed _and_ the reason
    // is simply that there were any changes that got made while we were in the
    // middle of the attempt. Any other problems are transparently thrown to the
    // caller.
    let retryDelayMsec = INITIAL_UPDATE_RETRY_MSEC;
    let attemptCount = 0;
    for (;;) {
      const now = Date.now();

      if (now >= timeoutTime) {
        throw Errors.timedOut(timeoutMsec);
      }

      attemptCount++;
      if (attemptCount !== 1) {
        this.log.info(`Update attempt #${attemptCount}.`);
      }

      const result =
        await this._attemptUpdate(change, baseSnapshot, expectedSnapshot, timeoutTime - now);

      if (result !== null) {
        return result;
      }

      this.log.info(`Sleeping ${retryDelayMsec} msec.`);
      await Delay.resolve(retryDelayMsec);
      retryDelayMsec = Math.min(retryDelayMsec * UPDATE_RETRY_GROWTH_FACTOR, MAX_UPDATE_RETRY_MSEC);
    }
  }

  /**
   * Waits for the given revision number to have been written. It returns only
   * after the change is made. If the change has already been made by the time
   * this method is called, then it returns promptly.
   *
   * **Note:** In unusual circumstances &mdash; in particular, when a document
   * gets re-created or for document parts that don't keep full change history
   * &mdash; and due to the asynchronous nature of the system, it is possible
   * for a change to not be available (e.g. via {@link #getChange}) soon after
   * the result of a call to this method becomes resolved. Calling code should
   * be prepared for that possibility.
   *
   * @param {Int} revNum The revision number to wait for.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {Int} The instantaneously current revision number when the method
   *   is complete. It is possible for it to be out-of-date by the time it is
   *   used by the caller.
   */
  async whenRevNum(revNum, timeoutMsec = null) {
    RevisionNumber.check(revNum);
    timeoutMsec = Timeouts.clamp(timeoutMsec);

    const clazz       = this.constructor;
    const timeoutTime = Date.now() + timeoutMsec;

    // Handles timeout (called twice, below).
    const timedOut = () => {
      // Log a message -- it's at least somewhat notable, though it does occur
      // regularly -- and throw `timedOut` with the original timeout value. (If
      // called as a result of catching a timeout from a file operation the
      // timeout value in the error might not be the original `timeoutMsec`.)

      // TODO: Make log message more descriptive, have timeoutMsec be the
      // timeout that was hit, versus the original one.
      this.log.info(`\`whenRevNum()\` timed out: ${timeoutMsec}msec`);
      throw Errors.timedOut(timeoutMsec);
    };

    // Loop until the overall timeout.
    for (;;) {
      const now = Date.now();
      if (now >= timeoutTime) {
        timedOut();
      }

      const currentRevNum = await this.currentRevNum();
      if (currentRevNum >= revNum) {
        // No more need to wait or, if this is the first iteration, no need to
        // wait at all.
        return currentRevNum;
      }

      // The current revision is the same as, or lower than, the given one, so
      // we have to wait for the file to change (or for the storage layer to
      // time out), and then check to see if in fact the revision number was
      // changed.

      const file = this.fileCodec.file;
      const codec = this.fileCodec.codec;
      const revNumPath = clazz.revisionNumberPath;
      const revNumHash = codec.encodeJsonBuffer(currentRevNum);

      // If this returns normally (doesn't throw), then we know it wasn't due
      // to hitting the timeout.
      try {
        await file.whenPathIsNot(revNumPath, revNumHash, timeoutTime - now);
      } catch (e) {
        // For a timeout, we log and report the original timeout value. For
        // everything else, we just transparently re-throw.
        if (Errors.is_timedOut(e)) {
          timedOut();
        }
        throw e;
      }
    }
  }

  /**
   * {array<FileOp>} Array of {@link FileOp}s which when made into a
   * {@link FileChange} will initialize the portion of the file which this class
   * is responsible for. This implementation should be sufficient for all
   * subclasses of this class.
   */
  get _impl_initOps() {
    const clazz = this.constructor;
    const codec = this.fileCodec.codec;

    return [
      // Clear out old data, if any. For example (and especially during
      // development), there might be data in an old schema. By the time we get
      // here, if there were anything to preserve it would have already been
      // preserved.
      FileOp.op_deletePathPrefix(clazz.pathPrefix),
      // Initial revision number.
      FileOp.op_writePath(clazz.revisionNumberPath, codec.encodeJsonBuffer(0)),
      // Empty change #0.
      FileOp.op_writePath(clazz.pathForChange(0), codec.encodeJsonBuffer(clazz.changeClass.FIRST))
    ];
  }

  /**
   * Subclass-specific implementation of `getSnapshot()`. Subclasses must
   * override this method.
   *
   * @abstract
   * @param {Int} revNum Which revision to get. Guaranteed to be a revision
   *   number for the instantaneously-current revision or earlier.
   * @returns {BaseSnapshot|null} Snapshot of the indicated revision. Must
   *   either be an instance of the concrete snapshot type appropriate for this
   *   instance or `null`. `null` specifically indicates that `revNum` is a
   *   revision older than what this instance can provide.
   */
  async _impl_getSnapshot(revNum) {
    return this._mustOverride(revNum);
  }

  /**
   * Rebases a given change, such that it can be appended as the revision after
   * the indicated instantaneously-current snapshot. Glibly speaking, this
   * method is called when {@link #update} determines that it can't simply
   * append a change as passed to it.
   *
   * Subclasses must override this method.
   *
   * @abstract
   * @param {BaseChange} change The change to apply, same as for
   *   {@link #update}, except additionally guaranteed to have a non-empty
   *  `delta`.
   * @param {BaseSnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {BaseSnapshot} expectedSnapshot The implied expected result as
   *   defined by {@link #update}.
   * @param {BaseSnapshot} currentSnapshot An instantaneously-current snapshot.
   *   Guaranteed to be a different revision than `baseSnapshot`.
   * @returns {BaseChange} Rebased (transformed) change, which is suitable for
   *   appending as revision `currentSnapshot.revNum + 1`.
   */
  async _impl_rebase(change, baseSnapshot, expectedSnapshot, currentSnapshot) {
    return this._mustOverride(change, baseSnapshot, expectedSnapshot, currentSnapshot);
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}. This works
   * for all concrete subclasses of this class. (It builds in knowledge of the
   * difference between durable and ephemeral parts, because it's easier to
   * build it that way than to have a call-out to a subclass-specific method.)
   *
   * @returns {string} One of the constants defined by {@link ValidationStatus}.
   */
  async _impl_validationStatus() {
    const clazz           = this.constructor;
    const { file, codec } = this.fileCodec;
    const fileSnapshot    = await file.getSnapshot();

    const encodedSnapshot = fileSnapshot.getOrNull(clazz.storedSnapshotPath);
    const snapshot        = encodedSnapshot ? codec.decodeJsonBuffer(encodedSnapshot) : undefined;
    const encodedRevNum   = fileSnapshot.getOrNull(clazz.revisionNumberPath);
    const revNum          = codec.decodeJsonBuffer(encodedRevNum);

    // Check the revision number (mandatory) and stored snapshot (if present).
    try {
      RevisionNumber.check(revNum);
    } catch (e) {
      this.log.info('Corrupt document: Bogus or missing revision number.');
      return ValidationStatus.STATUS_error;
    }

    if (snapshot) {
      try {
        clazz.snapshotClass.check(snapshot);
      } catch (e) {
        this.log.info('Corrupt document: Bogus stored snapshot (wrong class).');
        return ValidationStatus.STATUS_error;
      }

      if (revNum < snapshot.revNum) {
        this.log.info('Corrupt document: Bogus stored snapshot (weird revision number).');
        return ValidationStatus.STATUS_error;
      }
    }

    // Make sure all the changes can be read and decoded.

    const MAX = MAX_CHANGE_READS_PER_ITERATION;

    // Ephemeral parts aren't expected to store any changes from before the
    // snapshot revision (when present). This definition marks the "inflection
    // point" at which changes must be present.
    const requiredChangesAt = (clazz.ephemeral && snapshot)
      ? snapshot.revNum + 1
      : 0;

    // For ephemeral parts, _if_ a change is present before the snapshot's
    // revision, it must be valid.
    for (let i = 0; i < requiredChangesAt; i += MAX) {
      const lastI = Math.min(i + MAX - 1, requiredChangesAt - 1);
      try {
        // `true` === Allow missing changes.
        await this._getChangeRange(i, lastI + 1, true);
      } catch (e) {
        this.log.info(`Corrupt document: Bogus change in range #${i}..${lastI}.`);
        return ValidationStatus.STATUS_error;
      }
    }

    // Check all required changes (for both durable and ephemeral parts).
    for (let i = requiredChangesAt; i <= revNum; i += MAX) {
      const lastI = Math.min(i + MAX - 1, revNum);
      try {
        // `false` === Do not allow missing changes.
        await this._getChangeRange(i, lastI + 1, false);
      } catch (e) {
        this.log.info(`Corrupt document: Bogus change in range #${i}..${lastI}.`);
        return ValidationStatus.STATUS_error;
      }
    }

    // Look for changes past the stored revision number to make sure they don't
    // exist. **TODO:** Handle the possibility that the document got a new
    // change added to it during the course of validation.

    let extraChanges;
    try {
      extraChanges = await this.listChangeRange(revNum + 1, revNum + 10000);
    } catch (e) {
      this.log.info('Corrupt document: Trouble listing changes.');
      return ValidationStatus.STATUS_error;
    }

    if (extraChanges.length !== 0) {
      this.log.info(`Corrupt document: Detected extra changes (at least ${extraChanges.length}).`);
      return ValidationStatus.STATUS_error;
    }

    // All's well!

    return ValidationStatus.STATUS_ok;
  }

  /**
   * Helper for {@link #update}, which performs one update attempt. This is
   * called from within the retry loop of the main method.
   *
   * @param {BaseChange} change The change to apply, same as for
   *   {@link #update}.
   * @param {BaseSnapshot} baseSnapshot Snapshot of the base from which the
   *   change is defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {BaseSnapshot} expectedSnapshot The implied expected result as
   *   defined by {@link #update}.
   * @param {Int} timeoutMsec Timeout to use for calls that could significantly
   *   block.
   * @returns {BaseChange|null} Result for the outer call to {@link #update}, or
   *   `null` if the attempt failed due to losing an append race.
   */
  async _attemptUpdate(change, baseSnapshot, expectedSnapshot, timeoutMsec) {
    const changeClass = this.constructor.changeClass;
    const deltaClass  = this.constructor.deltaClass;

    this.log.event.attemptUpdate(change.revNum, baseSnapshot.revNum, expectedSnapshot.revNum);

    // **TODO:** Consider whether we should make this call have an explicit
    // timeout. (It would require adding an argument to the method.)
    const currentSnapshot = await this.getSnapshot();

    const changeToAppend = (baseSnapshot.revNum === currentSnapshot.revNum)
      ? change
      : await this._impl_rebase(change, baseSnapshot, expectedSnapshot, currentSnapshot);

    if (changeToAppend.delta.isEmpty()) {
      // It turns out that nothing changed. **Note:** This case is unusual,
      // but it _can_ happen in practice. For example, if there is an append
      // race between two changes that both do the same thing (e.g., delete
      // the same characters from the document body), then the result from
      // rebasing the losing change will have an empty delta.
      return new changeClass(currentSnapshot.revNum, deltaClass.EMPTY);
    }

    const appendSuccess = await this.appendChange(changeToAppend, timeoutMsec);

    if (appendSuccess) {
      if (change === changeToAppend) {
        // The easy case: We didn't have to rebase and succeeded in appending
        // the change as-is. No correction!
        return new changeClass(change.revNum, deltaClass.EMPTY);
      } else {
        const resultSnapshot = await this.getSnapshot(changeToAppend.revNum);
        const correction     = expectedSnapshot.diff(resultSnapshot);

        this.log.event.updateSucceeded(change.revNum, baseSnapshot.revNum, expectedSnapshot.revNum);

        return correction;
      }
    }

    this.log.event.updateFailed(change.revNum, baseSnapshot.revNum, expectedSnapshot.revNum);

    // A `false` result from the above call means that we lost an update race
    // (that is, there was revision skew that occurred during the update
    // attempt). The `null` return value here is detected by the loop in {@link
    // #update}.

    return null;
  }

  /**
   * Checks the validity of a (possibly empty) range of revision numbers, where
   * both arguments must be syntactically correct revision numbers, where the
   * second must be no less than the first, and where the second must correspond
   * to a revision (change record) that exists in the document part or be no
   * more than one revision number beyond the end.
   *
   * @param {Int} startInclusive First revision number (inclusive).
   * @param {Int} endExclusive Last revision number (exclusive).
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @throws {Error} Thrown if the constraints as described above are violated.
   */
  async _checkRevNumRange(startInclusive, endExclusive, timeoutMsec = null) {
    RevisionNumber.check(startInclusive);
    RevisionNumber.min(endExclusive, startInclusive);

    const currentRevNum = await this.currentRevNum(timeoutMsec);

    RevisionNumber.maxInc(endExclusive, currentRevNum + 1);
  }

  /**
   * Reads a sequential chunk of changes. It is an error to request a change
   * beyond the current revision; it is valid for either `startInclusive` or
   * `endExclusive` to be `currentRevNum() + 1` but no greater. If
   * `startInclusive === endExclusive`, then this simply verifies that the
   * arguments are in range and returns an empty array. It is an error if
   * `(endExclusive - startInclusive) > MAX_CHANGE_READS_PER_ITERATION`.
   *
   * For subclasses that are ephemeral (don't keep full change history) and
   * when `allowMissing` is passed as `true`, it is possible for the first
   * element of the result to have a revision number greater than the requested
   * `startInclusive`, and it is also possible for the result to simply be empty
   * even if a non-zero number of changes were requested.
   *
   * **Note:** The point of the max count limit is that we want to avoid
   * performing an operation which could run so long as to clog Node's top-level
   * event dispatch loop.
   *
   * @param {Int} startInclusive Start change number (inclusive) of changes to
   *   read.
   * @param {Int} endExclusive End change number (exclusive) of changes to read.
   *   Must be `>= startInclusive`.
   * @param {boolean} allowMissing Whether (`true`) or not (`false`) to allow
   *   there to be missing changes from the range. If `false`, the result is
   *   always an array of length `endExclusive - startInclusive`.
   * @returns {array<BaseChange>} Array of changes, in order by revision number.
   */
  async _getChangeRange(startInclusive, endExclusive, allowMissing) {
    const clazz = this.constructor;

    RevisionNumber.check(startInclusive);
    RevisionNumber.min(endExclusive, startInclusive);
    TBoolean.check(allowMissing);

    if ((endExclusive - startInclusive) > MAX_CHANGE_READS_PER_ITERATION) {
      // The calling code (in this class) should have made sure we weren't
      // violating this restriction.
      throw Errors.badUse(`Too many changes requested at once: ${endExclusive - startInclusive}`);
    }

    // Per docs, reject a start (and implicitly an end) that would try to read
    // a never-possibly-written change.
    const revNum = await this.currentRevNum();
    RevisionNumber.maxInc(startInclusive, revNum + 1);

    if (startInclusive === endExclusive) {
      // Per docs, this is valid and has an empty result.
      return [];
    }

    const result          = [];
    const { file, codec } = this.fileCodec;
    const snapshot        = await file.getSnapshot();
    const prefix          = this.constructor.changePathPrefix;
    const data            = snapshot.getPathRange(prefix, startInclusive, endExclusive);

    this.log.event.gettingChangeRange(startInclusive, endExclusive);

    for (let i = startInclusive; i < endExclusive; i++) {
      const path = clazz.pathForChange(i);

      if (data.has(path)) {
        const encodedChange = data.get(path);
        const change        = codec.decodeJsonBuffer(encodedChange);

        clazz.changeClass.check(change);
        result.push(change);
        allowMissing = false; // Only allow missing changes at the _start_ of the range.
      } else if (!allowMissing) {
        throw Errors.badUse(`Missing change in requested range: r${i}`);
      }
    }

    this.log.event.gotChangeRange(startInclusive, endExclusive);

    return result;
  }

  /**
   * Constructs and writes the stored snapshot based on the indicated revision,
   * if it is in fact appropriate to do so. If not, this does nothing.
   *
   * If this instance controls an ephemeral part, _and_ it is writing a
   * snapshot, then in addition to the snapshot write this method deletes
   * changes whose revision number is earlier than the previously-stored
   * snapshot. (The point of keeping any changes at all from before the snapshot
   * is to allow clients to perform change detection across a snapshot boundary
   * without running into errors.)
   *
   * **Note:** Beyond parameter checking, this method encapsulates all errors.
   * Assuming a valid call, this method should not throw.
   *
   * @param {Int} revNum Revision number in question.
   */
  async _maybeWriteStoredSnapshot(revNum) {
    RevisionNumber.check(revNum);

    if ((revNum % CHANGES_PER_STORED_SNAPSHOT) !== 0) {
      // Nope, no snapshot should be made for this revision.
      return;
    }

    try {
      this.log.event.writingStoredSnapshot(revNum);

      const snapshot = await this.getSnapshot(revNum);
      await this._writeStoredSnapshot(snapshot);
    } catch (e) {
      // Though unfortunate, this isn't tragic: Stored snapshots are created on
      // a best-effort basis. To the extent that they're required, it's only for
      // "ephemeral" document parts that don't keep full history, and such parts
      // only ever arrange for earlier changes to be erased after a later
      // snapshot is _known_ to be written. (**Note::** As of this writing,
      // there aren't yet any ephemeral document parts, though the caret info is
      // slated to become one.)
      this.log.warn(`Trouble writing stored snapshot for revision: r${revNum}`, e);
    }

    this.log.event.wroteStoredSnapshot(revNum);
  }

  /**
   * Writes the given snapshot into the stored snapshot file path for this
   * document part. In addition, this deletes changes that have "aged out" from
   * ephemeral parts.
   *
   * @param {BaseSnapshot} snapshot The snapshot to store. Must be an instance
   *   of the appropriate concrete snapshot class for this instance.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   */
  async _writeStoredSnapshot(snapshot, timeoutMsec = null) {
    const clazz = this.constructor;
    const path = clazz.storedSnapshotPath;
    const codec = this.fileCodec.codec;

    clazz.snapshotClass.check(snapshot);

    // Which changes to delete. This is "none" if the part is durable (not
    // ephemeral) _or_ if there aren't more than a per-snapshot's worth of
    // changes in the part yet.
    const deleteBefore = clazz.ephemeral
      ? Math.max(0, snapshot.revNum - CHANGES_PER_STORED_SNAPSHOT)
      : 0;

    const fileOps = [
      FileOp.op_writePath(path, codec.encodeJsonBuffer(snapshot))
    ];

    if (deleteBefore !== 0) {
      fileOps.push(FileOp.op_deletePathRange(this.constructor.changePathPrefix, 0, deleteBefore));
    }

    const fileChange = new FileChange(snapshot.revNum + 1, fileOps);

    await this._appendChangeWithRetry(fileChange, timeoutMsec);

    this.log.info('Wrote stored snapshot for revision:', snapshot.revNum);
  }

  /**
   * Subclass-specific change validation. Subclasses must override this method.
   *
   * @abstract
   * @param {BaseChange} change Change to apply.
   * @param {BaseSnapshot} baseSnapshot The base snapshot the change is being
   *   applied to.
   * @throws {Error} Thrown if `change` is not valid as a change to
   *   `baseSnapshot`.
   */
  _impl_validateChange(change, baseSnapshot) {
    this._mustOverride(change, baseSnapshot);
  }

  /**
   * {string} `StoragePath` prefix string to use for file storage for the
   * portion of the document controlled by instances of this class. Subclasses
   * must override override this.
   *
   * @abstract
   */
  static get _impl_pathPrefix() {
    return this._mustOverride();
  }

  /**
   * {class} Class (constructor function) of snapshot objects to be used with
   * instances of this class. Subclasses must fill this in.
   *
   * @abstract
   */
  static get _impl_snapshotClass() {
    return this._mustOverride();
  }
}
