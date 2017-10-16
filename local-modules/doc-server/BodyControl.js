// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, BodyDelta, BodySnapshot, RevisionNumber } from 'doc-common';
import { Errors, TransactionSpec } from 'file-store';
import { Delay } from 'promise-util';
import { Errors as UtilErrors, InfoError } from 'util-common';

import BaseControl from './BaseControl';
import Paths from './Paths';

/** {Int} Initial amount of time (in msec) between append retries. */
const INITIAL_APPEND_RETRY_MSEC = 50;

/** {Int} Growth factor for append retry delays. */
const APPEND_RETRY_GROWTH_FACTOR = 5;

/**
 * {Int} Maximum amount of time to spend (in msec) retrying append
 * operations.
 */
const MAX_APPEND_TIME_MSEC = 20 * 1000; // 20 seconds.

/**
 * {Int} Maximum number of document changes to request in a single
 * transaction. (The idea is to avoid making a request that would result in
 * running into an upper limit on transaction data size.)
 */
const MAX_CHANGE_READS_PER_TRANSACTION = 20;

/**
 * Controller for a given document's body content.
 *
 * There is only ever exactly one instance of this class per document, no matter
 * how many active editors there are on that document. (This guarantee is
 * provided by virtue of the fact that `DocServer` only ever creates one
 * `FileComplex` per document, and each `FileComplex` instance only ever makes
 * one instance of this class.
 */
export default class BodyControl extends BaseControl {
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
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super(fileComplex);

    /**
     * {Map<RevisionNumber, BodySnapshot>} Mapping from revision numbers to
     * corresponding document snapshots. Sparse.
     */
    this._snapshots = new Map();

    Object.seal(this);
  }

  /**
   * Creates or re-creates the document body. This will result in a body with an
   * empty change for revision `0` and a `revNum` of `0`.
   */
  async create() {
    this.log.info('Creating document body.');

    const fc = this.fileCodec; // Avoids boilerplate immediately below.

    const spec = new TransactionSpec(
      // If the file already existed, this clears out the old contents.
      // **TODO:** This clears the entire file, not just the body. This should
      // only really clear the body-specific prefix.
      fc.op_deleteAll(),

      // Version for the file schema. **TODO:** As above, this path isn't
      // body-specific and so would be better handled elsewhere.
      fc.op_writePath(Paths.SCHEMA_VERSION, this.fileComplex.schemaVersion),

      // Initial revision number.
      fc.op_writePath(Paths.BODY_REVISION_NUMBER, 0),

      // Empty change #0 (per documented interface).
      fc.op_writePath(Paths.forBodyChange(0), BodyChange.FIRST),
    );

    await this.file.create();
    await this.file.transact(spec);

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
   * @returns {BodyChange} The requested change.
   */
  async getChange(revNum) {
    RevisionNumber.check(revNum);

    const changes = await this._readChangeRange(revNum, revNum + 1);
    return changes[0];
  }

  /**
   * Returns a promise for a revision &mdash; any revision &mdash; of the
   * document after the given `baseRevNum`, with the return result represented
   * as a change relative to that given revision. If called when `baseRevNum` is
   * the current revision, this will not resolve the result promise until at
   * least one change has been made.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @returns {BodyChange} Delta and associated information. The result's
   *   `revNum` is guaranteed to be at least one more than `baseRevNum` (and
   *   could possibly be even larger.) The result can be applied to revision
   *   `baseRevNum` to produce revision `revNum` of the document. The
   *   `timestamp` and `author` of the result will both be `null`.
   */
  async getChangeAfter(baseRevNum) {
    RevisionNumber.check(baseRevNum);

    for (;;) {
      const revNum = await this.currentRevNum();

      // We can only validate the upper limit of `baseRevNum` after we have
      // determined the document revision number. If we end up iterating we'll
      // do redundant checks, but that's a very minor inefficiency.
      RevisionNumber.maxInc(baseRevNum, revNum);

      if (baseRevNum < revNum) {
        // The document's revision is in fact newer than the base, so we can now
        // form and return a result. Compose all the deltas from the revision
        // after the base through and including the current revision.
        const delta = await this._composeRevisions(
          BodyDelta.EMPTY, baseRevNum + 1, revNum + 1);
        return new BodyChange(revNum, delta);
      }

      // Wait for the file to change (or for the storage layer to time out), and
      // then iterate to see if in fact the change updated the document revision
      // number.
      const fc   = this.fileCodec;
      const ops  = [fc.op_whenPathNot(Paths.BODY_REVISION_NUMBER, revNum)];
      const spec = new TransactionSpec(...ops);
      try {
        await fc.transact(spec);
      } catch (e) {
        if (!Errors.isTimeout(e)) {
          // It's _not_ a timeout, so we should propagate the error.
          throw e;
        }
        // It's a timeout, so just fall through and iterate.
        this.log.info('Storage layer timeout in `getChangeAfter`.');
      }
    }
  }

  /**
   * Gets a snapshot of the full document contents.
   *
   * @param {Int|null} revNum Which revision to get. If passed as `null`,
   *   indicates the latest (most recent) revision.
   * @returns {BodySnapshot} The corresponding snapshot.
   */
  async getSnapshot(revNum = null) {
    const currentRevNum = await this.currentRevNum();
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
      ? this._composeRevisions(BodyDelta.EMPTY, 0,               revNum + 1)
      : this._composeRevisions(base.contents,   base.revNum + 1, revNum + 1);
    const result = new BodySnapshot(revNum, await contents);

    this.log.detail('Made snapshot for revision:', revNum);

    this._snapshots.set(revNum, result);
    return result;
  }

  /**
   * Takes a body change consisting of full information (resulting revision
   * number, delta, possibly-`null` author ID, and timestamp), and applies it,
   * including merging of any intermediate revisions. The return value consists
   * of a "correction" change to be used to get the new document state. The
   * correction is with respect to the client's "expected result," that is to
   * say, what the client would get if the operations were applied with no
   * intervening changes. So, for example, if the change is able to be applied
   * as exactly given, the returned correction will have an empty `delta`.
   *
   * As a special case, if the `revNum` is valid and `ops` is empty, this method
   * returns a result of the same revision number along with an empty
   * correction. That is, the return value from passing an empty delta doesn't
   * provide any information about subsequent revisions of the document.
   *
   * **Note:** This method trusts the `authorId` and `timestamp`, and as such it
   * is _not_ appropriate to expose this method directly to client access.
   *
   * @param {BodyChange} change Change to apply.
   * @returns {BodyChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the document.
   */
  async update(change) {
    // This makes sure we have a proper instance, but doesn't check for deeper
    // problems (such as an invalid `revNum`). Once in the guts of the
    // operation, we will discover (and properly complain) if things are amiss.
    BodyChange.check(change);

    // Snapshot of the base revision. This call effectively validates
    // `change.revNum`.
    const base = await this.getSnapshot(change.revNum - 1);

    // Check for an empty `delta`. If it is, we don't bother trying to apply it.
    // See method header comment for more info.
    if (change.delta.isEmpty()) {
      return new BodyChange(base.revNum, BodyDelta.EMPTY);
    }

    // Compose the implied expected result. This has the effect of validating
    // the contents of `delta`.
    const expected = base.compose(change);

    // Try performing the apply, and then iterate if it failed _and_ the reason
    // is simply that there were any changes that got made while we were in the
    // middle of the attempt. Any other problems are transparently thrown to the
    // caller.
    let retryDelayMsec = INITIAL_APPEND_RETRY_MSEC;
    let retryTotalMsec = 0;
    let attemptCount = 0;
    for (;;) {
      attemptCount++;
      if (attemptCount !== 1) {
        this.log.info(`Append attempt #${attemptCount}.`);
      }

      const result = await this._applyUpdateTo(base, change, expected);

      if (result !== null) {
        return result;
      }

      // A `null` result from the call means that we lost an append race (that
      // is, there was revision skew between the snapshot and the latest reality
      // at the moment of attempted appending), so we delay briefly and iterate.

      if (retryTotalMsec >= MAX_APPEND_TIME_MSEC) {
        // ...except if these attempts have taken wayyyy too long. If we land
        // here, it's probably due to a bug (but not a total given).
        throw UtilErrors.aborted('Too many failed attempts in `update()`.');
      }

      this.log.info(`Sleeping ${retryDelayMsec} msec.`);
      await Delay.resolve(retryDelayMsec);
      retryTotalMsec += retryDelayMsec;
      retryDelayMsec *= APPEND_RETRY_GROWTH_FACTOR;
    }
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
    if (!(await this.file.exists())) {
      return BodyControl.STATUS_NOT_FOUND;
    }

    let transactionResult;

    // Check the required metainfo paths.

    try {
      const fc = this.fileCodec;
      const spec = new TransactionSpec(
        fc.op_readPath(Paths.SCHEMA_VERSION),
        fc.op_readPath(Paths.BODY_REVISION_NUMBER)
      );
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.info('Corrupt document: Failed to read/decode basic data.');
      return BodyControl.STATUS_ERROR;
    }

    const data          = transactionResult.data;
    const schemaVersion = data.get(Paths.SCHEMA_VERSION);
    const revNum        = data.get(Paths.BODY_REVISION_NUMBER);

    if (!schemaVersion) {
      this.log.info('Corrupt document: Missing schema version.');
      return BodyControl.STATUS_ERROR;
    }

    if (!revNum) {
      this.log.info('Corrupt document: Missing revision number.');
      return BodyControl.STATUS_ERROR;
    }

    const expectSchemaVersion = this.fileComplex.schemaVersion;
    if (schemaVersion !== expectSchemaVersion) {
      const got = schemaVersion;
      this.log.info(`Mismatched schema version: got ${got}; expected ${expectSchemaVersion}`);
      return BodyControl.STATUS_MIGRATE;
    }

    try {
      RevisionNumber.check(revNum);
    } catch (e) {
      this.log.info('Corrupt document: Bogus revision number.');
      return BodyControl.STATUS_ERROR;
    }

    // Make sure all the changes can be read and decoded.

    const MAX = MAX_CHANGE_READS_PER_TRANSACTION;
    for (let i = 0; i <= revNum; i += MAX) {
      const lastI = Math.min(i + MAX - 1, revNum);
      try {
        await this._readChangeRange(i, lastI + 1);
      } catch (e) {
        this.log.info(`Corrupt document: Bogus change in range #${i}..${lastI}.`);
        return BodyControl.STATUS_ERROR;
      }
    }

    // Look for a few changes past the stored revision number to make sure
    // they're empty.

    try {
      const fc  = this.fileCodec;
      const ops = [];
      for (let i = revNum + 1; i <= (revNum + 10); i++) {
        ops.push(fc.op_readPath(Paths.forBodyChange(i)));
      }
      const spec = new TransactionSpec(...ops);
      transactionResult = await fc.transact(spec);
    } catch (e) {
      this.log.info('Corrupt document: Weird empty-change read failure.');
      return BodyControl.STATUS_ERROR;
    }

    // In a valid doc, the loop body won't end up executing at all.
    for (const storagePath of transactionResult.data.keys()) {
      this.log.info('Corrupt document. Extra change at path:', storagePath);
      return BodyControl.STATUS_ERROR;
    }

    // All's well!

    return BodyControl.STATUS_OK;
  }

  /**
   * Underlying implementation of `currentRevNum()`, as required by the
   * superclass.
   *
   * @returns {Int} The instantaneously-current revision number.
   */
  async _impl_currentRevNum() {
    const fc = this.fileCodec;
    const storagePath = Paths.BODY_REVISION_NUMBER;
    const spec = new TransactionSpec(
      fc.op_checkPathPresent(storagePath),
      fc.op_readPath(storagePath)
    );

    const transactionResult = await fc.transact(spec);
    return transactionResult.data.get(storagePath);
  }

  /**
   * Appends a new change to the document. On success, this returns the revision
   * number of the document after the append. On a failure due to `baseRevNum`
   * not being current at the moment of application, this returns `null`. All
   * other errors are reported via thrown errors. See `_applyUpdateTo()` above
   * for further discussion.
   *
   * **Note:** If the change is a no-op, then this method throws an error,
   * because the calling code should have handled that case without calling this
   * method.
   *
   * @param {BodyChange} change Change to append.
   * @returns {Int|null} The revision number after appending `change`, or `null`
   *   if `change.revNum` is out-of-date (that is, isn't the immediately-next
   *   revision number) at the moment of attempted application.
   * @throws {Error} If `change.delta.isEmpty()`.
   */
  async _appendChange(change) {
    BodyChange.check(change);

    if (change.delta.isEmpty()) {
      throw UtilErrors.wtf('Should not have been called with an empty change.');
    }

    const revNum     = change.revNum;
    const baseRevNum = revNum - 1;
    const changePath = Paths.forBodyChange(revNum);

    const fc   = this.fileCodec; // Avoids boilerplate immediately below.
    const spec = new TransactionSpec(
      fc.op_checkPathAbsent(changePath),
      fc.op_checkPathIs(Paths.BODY_REVISION_NUMBER, baseRevNum),
      fc.op_writePath(changePath, change),
      fc.op_writePath(Paths.BODY_REVISION_NUMBER, revNum)
    );

    try {
      await fc.transact(spec);
    } catch (e) {
      if ((e instanceof InfoError) && (e.name === 'path_not_empty')) {
        // This happens if and when we lose an append race, which will regularly
        // occur if there are simultaneous editors.
        this.log.info('Lost append race for revision:', revNum);
        return null;
      } else {
        // No other errors are expected, so just rethrow.
        throw e;
      }
    }

    return revNum;
  }

  /**
   * Main implementation of `update()`, which takes additional arguments of a
   * `base` snapshot being applied to and the `expected` result of a clean
   * application on top of that `base`. This method attempts to apply the change
   * relative to that snapshot. If it succeeds (that is, if it manages to
   * get an instantaneous current snapshot, and use that snapshot to create a
   * final change which is successfully appended to the document, without an
   * other "racing" code doing the same first), then this method returns a
   * proper result for an outer `update()` call. If it fails due to a lost race,
   * then this method returns `null`. All other problems are reported by
   * throwing an error.
   *
   * @param {BodySnapshot} base Snapshot of the base from which the delta is
   *   defined. That is, this is the snapshot of `change.revNum - 1`.
   * @param {BodyChange} change The change to apply, same as for `update()`.
   * @param {BodySnapshot} expected The implied expected result as defined
   *   by `update()`.
   * @returns {BodyChange|null} Result for the outer call to `update()`,
   *   or `null` if the application failed due to an out-of-date `snapshot`.
   */
  async _applyUpdateTo(base, change, expected) {
    // Instantaneously current (latest) revision of the document. We'll find out
    // if it turned out to remain current when we finally get to try appending
    // the (possibly modified) change, below.
    const current = await this.getSnapshot();

    if (base.revNum === current.revNum) {
      // The easy case, because the base revision is in fact the current
      // revision of the document, so we don't have to transform the incoming
      // delta. We merely have to apply the given `delta` to the current
      // revision. If it succeeds, then we won the append race (if any).

      const revNum = await this._appendChange(change);

      if (revNum === null) {
        // Turns out we lost an append race.
        return null;
      }

      return new BodyChange(revNum, BodyDelta.EMPTY);
    }

    // The hard case: The client has requested an application of a delta
    // (hereafter `dClient`) against a revision of the document which is _not_
    // the current revision (hereafter, `rBase` for the common base and
    // `rCurrent` for the current revision). Here's what we do:
    //
    // 0. Definitions of input:
    //    * `dClient` -- Delta (ops) to apply, as requested by the client.
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
    //    This is `dCorrection`. Return this to the client; they will compose
    //    `rExpected` with `dCorrection` to arrive at `rNext`.

    // (0) Assign incoming arguments to variables that correspond to the
    //     description immediately above.

    const dClient   = change.delta;
    const rBase     = base;
    const rExpected = expected;
    const rCurrent  = current;

    // (1)

    const dServer = await this._composeRevisions(
      BodyDelta.EMPTY, rBase.revNum + 1, rCurrent.revNum + 1);

    // (2)

    // The `true` argument indicates that `dServer` should be taken to have been
    // applied first (won any insert races or similar).
    const dNext = dServer.transform(dClient, true);

    if (dNext.isEmpty()) {
      // It turns out that nothing changed. **Note:** It is unclear whether this
      // can actually happen in practice, given that we already return early
      // (in `update()`) if we are asked to apply an empty delta.
      return new BodyChange(rCurrent.revNum, BodyDelta.EMPTY);
    }

    // (3)

    const rNextNum     = rCurrent.revNum + 1;
    const appendResult = await this._appendChange(
      new BodyChange(rNextNum, dNext, change.timestamp, change.authorId));

    if (appendResult === null) {
      // Turns out we lost an append race.
      return null;
    }

    const rNext = await this.getSnapshot(rNextNum);

    // (4)

    // **Note:** The result's `revNum` is the same as `rNext`'s, which is
    // exactly what we want.
    const dCorrection = rExpected.diff(rNext);
    return dCorrection;
  }

  /**
   * Constructs a delta consisting of the composition of the deltas from the
   * given initial revision through but not including the indicated end
   * revision, and composed from a given base. It is valid to pass as either
   * revision number parameter one revision beyond the current document revision
   * number (that is, `(await this.currentRevNum()) + 1`. It is invalid to
   * specify a non-existent revision _other_ than one beyond the current
   * revision. If `startInclusive === endExclusive`, then this method returns
   * `baseDelta`.
   *
   * @param {BodyDelta} baseDelta Base delta onto which the indicated deltas
   *   get composed.
   * @param {Int} startInclusive Revision number for the first delta to include
   *   in the result.
   * @param {Int} endExclusive Revision number just beyond the last delta to
   *   include in the result.
   * @returns {BodyDelta} The composed operations (raw delta) consisting of
   *   `baseDelta` composed with revisions `startInclusive` through but not
   *   including `endExclusive`.
   */
  async _composeRevisions(baseDelta, startInclusive, endExclusive) {
    BodyDelta.check(baseDelta);

    if (startInclusive === endExclusive) {
      // Trivial case: Nothing to compose. If we were to have made it to the
      // loop below, `_readChangeRange()` would have taken care of the error
      // checking on the range arguments. But because we're short-circuiting out
      // of it here, we need to explicitly make a call to confirm argument
      // validity.
      await this._readChangeRange(startInclusive, startInclusive);
      return baseDelta;
    }

    let result = baseDelta;
    const MAX = MAX_CHANGE_READS_PER_TRANSACTION;
    for (let i = startInclusive; i < endExclusive; i += MAX) {
      const end = Math.min(i + MAX, endExclusive);
      const changes = await this._readChangeRange(i, end);
      for (const c of changes) {
        result = result.compose(c.delta);
      }
    }

    return result;
  }

  /**
   * Reads a sequential set of changes. It is an error to request a change that
   * does not exist. It is valid for either `start` or `endExc` to indicate a
   * change that does not exist _only_ if it is one past the last existing
   * change. If `start === endExc`, then this verifies that the arguments are in
   * range and returns an empty array. It is an error if `(endExc - start) >
   * MAX_CHANGE_READS_PER_TRANSACTION`.
   *
   * **Note:** The point of the max count limit is that we want to avoid
   * creating a transaction which could run afoul of a limit on the amount of
   * data returned by any one transaction.
   *
   * @param {Int} start Start change number (inclusive) of changes to read.
   * @param {Int} endExc End change number (exclusive) of changes to read.
   * @returns {array<BodyChange>} Array of changes, in order by change
   *   number.
   */
  async _readChangeRange(start, endExc) {
    RevisionNumber.check(start);
    RevisionNumber.min(endExc, start);

    if ((endExc - start) > MAX_CHANGE_READS_PER_TRANSACTION) {
      // The calling code (in this class) should have made sure we weren't
      // violating this restriction.
      throw UtilErrors.wtf('Too many changes requested at once.');
    }

    if (start === endExc) {
      // Per docs, just need to verify that the arguments don't name an invalid
      // change. `0` is always valid, so we don't actually need to check that.
      if (start !== 0) {
        const revNum = await this.currentRevNum();
        RevisionNumber.maxInc(start, revNum + 1);
      }
      return [];
    }

    const paths = [];
    for (let i = start; i < endExc; i++) {
      paths.push(Paths.forBodyChange(i));
    }

    const fc = this.fileCodec;
    const ops = [];
    for (const p of paths) {
      ops.push(fc.op_checkPathPresent(p));
      ops.push(fc.op_readPath(p));
    }

    const spec              = new TransactionSpec(...ops);
    const transactionResult = await fc.transact(spec);
    const data              = transactionResult.data;

    const result = [];
    for (const p of paths) {
      const change = BodyChange.check(data.get(p));
      result.push(change);
    }

    return result;
  }
}
