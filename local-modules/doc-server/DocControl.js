// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { DeltaResult, DocumentChange, FrozenDelta, RevisionNumber, Snapshot, Timestamp }
  from 'doc-common';
import { BaseFile, Coder, FileOp, TransactionSpec } from 'content-store';
import { Logger } from 'see-all';
import { TString } from 'typecheck';
import { CommonBase, InfoError, PromDelay } from 'util-common';

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
   * @param {BaseFile} file The underlying document storage.
   * @param {FrozenBuffer} formatVersion Format version to expect and use.
   */
  constructor(file, formatVersion) {
    super();

    /** {BaseFile} The underlying document storage. */
    this._file = BaseFile.check(file);

    /** {FrozenBuffer} The document format version to expect and use. */
    this._formatVersion = formatVersion;

    /**
     * {Map<RevisionNumber,Snapshot>} Mapping from revision numbers to
     * corresponding document snapshots. Sparse.
     */
    this._snapshots = new Map();

    /** {Logger} Logger specific to this document's ID. */
    this._log = log.withPrefix(`[${this._file.id}]`);

    this._log.detail('Constructed.');
  }

  /** {string} The ID of the document that this instance represents. */
  get id() {
    return this._file.id;
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

    // Per spec, a document starts with an empty change #0.
    const change0 = DocumentChange.firstChange();

    // If we get passed `contents`, that goes into change #1. We make an array
    // here (in either case) so that we can just use the `...` operator when
    // constructing the transaction spec.
    const maybeChange1 = [];
    if (contents !== null) {
      const change = new DocumentChange(1, Timestamp.now(), contents, null);
      const op     = FileOp.op_writePath(Paths.forRevNum(1), Coder.encode(change));
      maybeChange1.push(op);
    }

    // Initial document revision number.
    const revNum = (contents === null) ? 0 : 1;

    const spec = new TransactionSpec(
      // These make the transaction fail if we lose a race to (re)create the
      // file.
      FileOp.op_checkPathEmpty(Paths.FORMAT_VERSION),
      FileOp.op_checkPathEmpty(Paths.REVISION_NUMBER),

      // Version for the file format.
      FileOp.op_writePath(Paths.FORMAT_VERSION, this._formatVersion),

      // Initial revision number.
      FileOp.op_writePath(Paths.REVISION_NUMBER, Coder.encode(revNum)),

      // Empty change #0 (per documented interface).
      FileOp.op_writePath(Paths.forRevNum(0), Coder.encode(change0)),

      // The given `content` (if any) for change #1.
      ...maybeChange1
    );

    await this._file.create();
    await this._file.transact(spec);

    // Any cached snapshots are no longer valid.
    this._snapshots = new Map();
  }

  /**
   * Gets a particular change to the document. The document consists of a
   * sequence of changes, each modifying revision N of the document to produce
   * revision N+1.
   *
   * @param {Int} revNum The revision number of the change. The result is the
   *   change which produced that revision. E.g., `0` is a request for the first
   *   change (the change from the empty document).
   * @returns {DocumentChange} The requested change.
   */
  async change(revNum) {
    return this._changeRead(revNum);
  }

  /**
   * Gets a snapshot of the full document contents.
   *
   * @param {Int|null} revNum Which revision to get. If passed as `null`,
   *   indicates the latest (most recent) revision.
   * @returns {Snapshot} The corresponding snapshot.
   */
  async snapshot(revNum = null) {
    const currentRevNum = await this._currentRevNum();
    revNum = (revNum === null)
      ? currentRevNum
      : RevisionNumber.maxInc(revNum, currentRevNum);

    // Search backward through the full revisions for a base for forward
    // composition.
    let base = null;
    for (let i = revNum; i >= 0; i--) {
      const v = this._snapshots.get(i);
      if (v) {
        base = v;
        break;
      }
    }

    if (base && (base.revNum === revNum)) {
      // Found the right revision!
      return base;
    }

    // We didn't actully find a snapshot of the requested revision. Apply deltas
    // to the base to produce the desired revision. Store it, and return it.

    const contents = (base === null)
      ? this._composeVersions(FrozenDelta.EMPTY, 0,               revNum + 1)
      : this._composeVersions(base.contents,     base.revNum + 1, revNum + 1);
    const result = new Snapshot(revNum, await contents);

    this._log.detail(`Made snapshot for revision ${revNum}.`);

    this._snapshots.set(revNum, result);
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
    if (!(await this._file.exists())) {
      return DocControl.STATUS_NOT_FOUND;
    }

    const formatVersion =
      await this._file.pathReadOrNull(Paths.FORMAT_VERSION);

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

    const revNumEncoded =
      await this._file.pathReadOrNull(Paths.REVISION_NUMBER);

    if (revNumEncoded === null) {
      this._log.info('Corrupt document: Missing revision number.');
      return DocControl.STATUS_ERROR;
    }

    let revNum;
    try {
      revNum = Coder.decode(revNumEncoded);
    } catch (e) {
      this._log.info('Corrupt document: Bogus revision number.');
      return DocControl.STATUS_ERROR;
    }

    for (let i = 0; i <= revNum; i++) {
      try {
        await this._changeRead(i);
      } catch (e) {
        this._log.info(`Corrupt document: Bogus change #${i}.`);
        return DocControl.STATUS_ERROR;
      }
    }

    // Look for a few changes past the stored revision number to make sure
    // they're empty.
    for (let i = revNum + 1; i <= (revNum + 10); i++) {
      try {
        const change = await this._changeReadOrNull(i);
        if (change !== null) {
          this._log.info(`Corrupt document: Extra change #${i}`);
          return DocControl.STATUS_ERROR;
        }
      } catch (e) {
        this._log.info(`Corrupt document: Bogus extra change #${i}.`);
        return DocControl.STATUS_ERROR;
      }
    }

    return DocControl.STATUS_OK;
  }

  /**
   * Returns a promise for a revision &mdash; any revision &mdash; of the
   * document after the given `baseRevNum`, with the return result represented
   * as a delta relative to that given revision. If called when `baseRevNum` is
   * the current revision, this will not resolve the result promise until at
   * least one change has been made.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @returns {DeltaResult} Delta and associated revision number. The result's
   *   `revNum` is guaranteed to be at least one more than `baseRevNum` (and
   *   could possibly be even larger.) The result's `delta` can be applied to
   *   revision `baseRevNum` to produce revision `revNum` of the document.
   */
  async deltaAfter(baseRevNum) {
    for (;;) {
      // It's essential to get the file revision number before asking for the
      // document revision number: Due to the asynch nature of the system, it's
      // possible for the document revision to be taken with regard to a later
      // file revision, and this ordering guarantees that the `whenChange()` we
      // do will properly return promptly when that situation occurs.
      const fileRevNum = await this._file.revNum();
      const docRevNum  = await this._currentRevNum();

      // We can only validate `baseRevNum` after we have resolved the document
      // revision number. If we end up iterating we'll do redundant checks, but
      // that's a very minor inefficiency.
      RevisionNumber.maxInc(baseRevNum, docRevNum);

      if (baseRevNum < docRevNum) {
        // The document's revision is in fact newer than the base, so we can now
        // form and return a result. Compose all the deltas from the revision
        // after the base through and including the current revision.
        const delta = await this._composeVersions(
          FrozenDelta.EMPTY, baseRevNum + 1, RevisionNumber.after(docRevNum));
        return new DeltaResult(docRevNum, delta);
      }

      // Wait for the file to change (or for the storage layer to timeout), and
      // then iterate to see if in fact the change updated the document revision
      // number.
      await this._file.whenChange('never', fileRevNum, Paths.REVISION_NUMBER);
    }
  }

  /**
   * Takes a base revision number and delta therefrom, and applies the delta,
   * including merging of any intermediate revisions. The return value consists
   * of a new revision number, and a delta to be used to get the new document
   * state. The delta is with respect to the client's "expected result," that
   * is to say, what the client would get if the delta were applied with no
   * intervening changes.
   *
   * As a special case, as long as `baseRevNum` is valid, if `delta` is empty,
   * this method returns a result of the same revision number along with an
   * empty "correction" delta. That is, the return value from passing an empty
   * delta doesn't provide any information about subsequent revisions of the
   * document.
   *
   * @param {Int} baseRevNum Revision number which `delta` is with respect to.
   * @param {FrozenDelta} delta Delta indicating what has changed with respect
   *   to `baseRevNum`.
   * @param {string|null} authorId Author of `delta`, or `null` if the change
   *   is to be considered authorless.
   * @returns {DeltaResult} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The promise resolves sometime after the
   *   delta has been applied to the document.
   */
  async applyDelta(baseRevNum, delta, authorId) {
    // Very basic argument validation. Once in the guts of the thing, we will
    // discover (and properly complain) if there are deeper problems with them.
    FrozenDelta.check(delta);
    TString.orNull(authorId);

    // Snapshot of the base revision. This call validates `baseRevNum`.
    const base = await this.snapshot(baseRevNum);

    // Check for an empty `delta`. If it is, we don't bother trying to apply it.
    // See method header comment for more info.
    if (delta.isEmpty()) {
      return new DeltaResult(baseRevNum, FrozenDelta.EMPTY);
    }

    // Compose the implied expected result. This has the effect of validating
    // the contents of `delta`.
    const expected = new Snapshot(
      RevisionNumber.after(baseRevNum),
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
      // is, there was revision skew between the snapshot and the latest reality
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
   * revision at the moment it resolves. This method attempts to perform change
   * application relative to that snapshot. If it succeeds (that is, if the
   * snapshot is still current at the moment of attempted application), then
   * this method returns a proper result of `applyDelta()`. If it fails due to
   * the snapshot being out-of-date, then this method returns `null`. All other
   * problems are reported by throwing an exception.
   *
   * @param {Snapshot} base Snapshot of the base from which the delta is
   *   defined. That is, this is the snapshot of `baseRevNum` as provided to
   *   `applyDelta()`.
   * @param {FrozenDelta} delta Same as for `applyDelta()`.
   * @param {string|null} authorId Same as for `applyDelta()`.
   * @param {Snapshot} current Snapshot of the current (latest) revision of the
   *   document.
   * @param {Snapshot} expected The implied expected result as defined by
   *   `applyDelta()`.
   * @returns {DeltaResult|null} Result for the outer call to `applyDelta()`,
   *   or `null` if the application failed due to an out-of-date `snapshot`.
   */
  async _applyDeltaTo(base, delta, authorId, current, expected) {
    if (base.revNum === current.revNum) {
      // The easy case, because the base revision is in fact the current
      // revision of the document, so we don't have to transform the incoming
      // delta. We merely have to apply the given `delta` to the current
      // revision. If it succeeds, then we won the append race (if any).

      const revNum = await this._appendDelta(base.revNum, delta, authorId);

      if (revNum === null) {
        // Turns out we lost an append race.
        return null;
      }

      return new DeltaResult(revNum, FrozenDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a revision of the document which is _not_
    // the current revision (hereafter, `rBase` for the common base and
    // `rCurrent` for the current revision). Here's what we do:
    //
    // 0. Definitions of input:
    //    * `dClient` -- Delta to apply, as requested by the client.
    //    * `rBase` -- Base revision to apply the delta to.
    //    * `rCurrent` -- Current (latest) revision of the document.
    //    * `rExpected` -- The implied expected result of application. This is
    //      `rBase.compose(dClient)` as revision number `rBase.revNum + 1`.
    // 1. Construct a combined delta for all the server changes made between
    //    `rBase` and `rCurrent`. This is `dServer`.
    // 2. Transform (rebase) `dClient` with regard to (on top of) `dServer`.
    //    This is `dNext`. If `dNext` turns out to be empty, stop here and
    //    report that fact.
    // 3. Apply `dNext` to `rCurrent`, producing `rNext` as the new current
    //    server revision.
    // 4. Construct a delta from `rExpected` to `rNext` (that is, the diff).
    //    This is `dCorrection`. This is what we return to the client; they will
    //    compose `rExpected` with `dCorrection` to arrive at `rNext`.
    // 5. Return the revision number of `rNext` along with the delta
    //    `dCorrection`.

    // (0) Assign incoming arguments to variables that correspond to the
    //     description immediately above.
    const dClient   = delta;
    const rBase     = base;
    const rExpected = expected;
    const rCurrent  = current;

    // (1)
    const dServer = await this._composeVersions(
      FrozenDelta.EMPTY, rBase.revNum + 1, RevisionNumber.after(rCurrent.revNum));

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = FrozenDelta.coerce(dServer.transform(dClient, true));

    if (dNext.isEmpty()) {
      // It turns out that nothing changed. **Note:** It is unclear whether this
      // can actually happen in practice, given that we already return early
      // (in `applyDelta()`) if we are asked to apply an empty delta.
      return new DeltaResult(rCurrent.revNum, FrozenDelta.EMPTY);
    }

    // (3)
    const vNextNum = await this._appendDelta(rCurrent.revNum, dNext, authorId);

    if (vNextNum === null) {
      // Turns out we lost an append race.
      return null;
    }

    const rNext = await this.snapshot(vNextNum);

    // (4)
    const dCorrection =
      FrozenDelta.coerce(rExpected.contents.diff(rNext.contents));

    // (5)
    return new DeltaResult(vNextNum, dCorrection);
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial revision through and including the current latest delta,
   * composed from a given base. It is valid to pass as either revision number
   * parameter one revision beyond the current revision number (that is,
   * `RevisionNumber.after(await this._currentRevNum())`. It is invalid to
   * specify a non-existent revision _other_ than one beyond the current
   * revision. If `startInclusive === endExclusive`, then this method returns
   * `baseDelta`.
   *
   * @param {FrozenDelta} baseDelta Base delta onto which the indicated deltas
   *   get composed.
   * @param {Int} startInclusive Revision number for the first delta to include
   *   in the result.
   * @param {Int} endExclusive Revision number just beyond the last delta to
   *   include in the result.
   * @returns {FrozenDelta} The composed delta consisting of `baseDelta`
   *   composed with revisions `startInclusive` through but not including
   *   `endExclusive`.
   */
  async _composeVersions(baseDelta, startInclusive, endExclusive) {
    const nextRevNum = RevisionNumber.after(await this._currentRevNum());
    startInclusive = RevisionNumber.rangeInc(startInclusive, 0, nextRevNum);
    endExclusive =
      RevisionNumber.rangeInc(endExclusive, startInclusive, nextRevNum);

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
   * Appends a new delta to the document. On success, this returns the revision
   * number of the document after the append. On a failure due to `baseRevNum`
   * not being current at the moment of application, this returns `null`. All
   * other errors are reported via thrown errors. See `_applyDeltaTo()` above
   * for further discussion.
   *
   * **Note:** If the delta is a no-op, then this method throws an error,
   * because the calling code should have handled that case without calling this
   * method.
   *
   * @param {Int} baseRevNum Revision number which this is to apply to.
   * @param {FrozenDelta} delta The delta to append.
   * @param {string|null} authorId The author of the delta.
   * @returns {Int|null} The revision number after appending `delta`, or `null`
   *   if `baseRevNum` is out-of-date at the moment of attempted application
   *   _and_ the `delta` is non-empty.
   */
  async _appendDelta(baseRevNum, delta, authorId) {
    if (delta.isEmpty()) {
      throw new Error('Should not have been called with an empty delta.');
    }

    const revNum = RevisionNumber.after(baseRevNum);
    const changePath = Paths.forRevNum(revNum);
    const change = new DocumentChange(revNum, Timestamp.now(), delta, authorId);
    const spec = new TransactionSpec(
      FileOp.op_checkPathEmpty(changePath),
      FileOp.op_writePath(changePath, Coder.encode(change)),
      FileOp.op_writePath(Paths.REVISION_NUMBER, Coder.encode(revNum))
    );

    try {
      await this._file.transact(spec);
    } catch (e) {
      if ((e instanceof InfoError) && (e.name === 'path_not_empty')) {
        // This happens if and when we lose an append race, which will regularly
        // occur if there are simultaneous editors.
        this._log.info(`Lost append race for revision ${revNum}.`);
        return null;
      } else {
        // No other errors are expected, so just rethrow.
        throw e;
      }
    }

    return revNum;
  }

  /**
   * Reads the change for the indicated revision number. This will return `null`
   * given a request for a change that doesn't exist.
   *
   * @param {RevisionNumber} revNum Revision number of the change. This
   *   indicates the change that produced that document revision.
   * @returns {DocumentChange|null} The corresponding change, or `null` if it
   *   doesn't exist.
   */
  async _changeReadOrNull(revNum) {
    const encoded = await this._file.pathReadOrNull(Paths.forRevNum(revNum));

    return (encoded === null)
      ? null
      : DocumentChange.check(Coder.decode(encoded));
  }

  /**
   * Reads the change for the indicated revision number. It is an error to
   * request a change that doesn't exist.
   *
   * @param {RevisionNumber} revNum Revision number of the change. This
   *   indicates the change that produced that document revision.
   * @returns {DocumentChange} The corresponding change.
   */
  async _changeRead(revNum) {
    const encoded = await this._file.pathRead(Paths.forRevNum(revNum));
    return DocumentChange.check(Coder.decode(encoded));
  }

  /**
   * Gets the current document revision number.
   *
   * @returns {RevisionNumber|null} The revision number, or `null` if it is not
   *   set.
   */
  async _currentRevNum() {
    const encoded = await this._file.pathReadOrNull(Paths.REVISION_NUMBER);
    return (encoded === null) ? null : Coder.decode(encoded);
  }
}
