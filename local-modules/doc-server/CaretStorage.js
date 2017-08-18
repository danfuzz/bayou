// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretSnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { CommonBase, PromDelay } from 'util-common';

import FileComplex from './FileComplex';
import Paths from './Paths';

/**
 * {Int} Minimum amount of time (in msec) to wait between reading stored carets.
 */
const READ_DELAY_MSEC = 10 * 1000; // 10 seconds.

/**
 * {Int} Maximum amount of time that a call to `whenRemoteChange()` will take
 * before timing out.
 *
 * **TODO:** The timeout is set to be quite low right now because the method
 * in question isn't really checking for anything, and so every call ends up
 * timing out. Once it performs real work, this should be changed to something
 * more like 5 minutes.
 */
const REMOTE_CHANGE_TIMEOUT_MSEC = 60 * 1000; // 1 minute.

/**
 * {Int} How long to wait (in msec) after sessions are updated before an attempt
 * is made to write session info to file storage. This keeps the system from
 * storing too many ephemeral session updates, with the downside that caret
 * sharing across servers has this much more latency than sharing between
 * sessions that reside on the same machine.
 */
const WRITE_DELAY_MSEC = 5 * 1000; // 5 seconds.

/** {Int} How long (in msec) to wait between write retries. */
const WRITE_RETRY_DELAY_MSEC = 10 * 1000; // Ten seconds.

/** {Int} How many times to retry writes. */
const MAX_WRITE_RETRIES = 10;

/**
 * Helper class for `CaretControl` which handles the underlying file storage of
 * caret information. Every caret that gets updated or removed via the public
 * methods on this class is considered to be "locally controlled," and so such
 * caret updates are pushed to the file storage.
 *
 * **TODO:** This class currently only ever _writes_ carets to storage but
 * doesn't ever read carets that might have been written by other servers. It
 * should in fact also try reading other carets, providing a way for the
 * caret controller to see them and get them updated in a timely fashion.
 */
export default class CaretStorage extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex that this instance is part
   *   of.
   */
  constructor(fileComplex) {
    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {FileCodec} File-codec wrapper to use. */
    this._fileCodec = fileComplex.fileCodec;

    /** {Logger} Logger specific to this document's ID. */
    this._log = fileComplex.log;

    /**
     * {Set<string>} Set of session IDs, indicating all of the editing sessions
     * which are being managed directly by this instance (and by extension, this
     * server).
     */
    this._localSessions = new Set();

    /**
     * {CaretSnapshot} Snapshot containing all currently-known carets, both
     * from local sessions and from file storage. **Note:** The `revNum` of this
     * snapshot never changes.
     */
    this._carets = CaretSnapshot.EMPTY;

    /**
     * {CaretSnapshot} Snapshot of carets as stored from this instance into file
     * storage. This is used to drive synchronization between `_carets` and file
     * storage.
     */
    this._storedCarets = CaretSnapshot.EMPTY;

    /**
     * {Int} Last time (in msec since the Unix Epoch) that carets were read
     * from storage.
     */
    this._lastReadTime = 0;

    /**
     * {Promise|null} Promise for the result of a pending storage read, or
     * `null` if no storage read is currently pending.
     */
    this._readResultProm = null;

    /**
     * {Promise|null} Promise for the result of a pending storage write, or
     * `null` if no storage write is currently pending.
     */
    this._writeResultProm = null;

    Object.seal(this);
  }

  /**
   * Deletes a locally-controlled session. This update will eventually get
   * written to file storage (unless superseded by another change to the same
   * session in the meantime).
   *
   * @param {Caret} caret Caret for the session to be deleted. Only the
   *   `sessionId` of the caret is actually used.
   */
  delete(caret) {
    Caret.check(caret);

    // Indicate that the local server is asserting authority over this session.
    // This means that, when it comes time to write out caret info, this session
    // will be removed from file storage.
    this._localSessions.add(caret.sessionId);

    this._carets = this._carets.withoutCaret(caret);
    this._needsWrite();
  }

  /**
   * Gets a snapshot of all remote carets, that is, carets represented in file
   * storage that haven't been pushed there by this server. The resulting
   * snapshot always has a revision number of `0`.
   *
   * This method doesn't wait for data to be read from storage &mdash; it always
   * returns immediately with whatever info is at hand &mdash; but if it has
   * been a while since the data was updated, this method will fire off an
   * asynchronous read, the results of which will eventually get integrated.
   *
   * @returns {CaretSnapshot} Snapshot of remote carets.
   */
  remoteSnapshot() {
    if (Date.now() >= (this._lastReadTime + READ_DELAY_MSEC)) {
      this._needsRead();
    }

    let result = this._carets;

    for (const s of this._localSessions) {
      result = result.withoutSession(s);
    }

    return result;
  }

  /**
   * Updates a caret for a locally-controlled session. This update will
   * eventually get written to file storage (unless superseded by another change
   * to the same session in the meantime).
   *
   * @param {Caret} caret Caret information to update.
   */
  update(caret) {
    Caret.check(caret);

    // Indicate that the local server is asserting authority over this session.
    // This means that, when it comes time to write out caret info, this session
    // will be written to file storage.
    this._localSessions.add(caret.sessionId);

    this._carets = this._carets.withCaret(caret);
    this._needsWrite();
  }

  /**
   * Waits for a change to the stored caret state. This method returns when a
   * change has been detected, or after the request times out.
   *
   * **TODO:** This is currently a no-op. It should be filled in.
   *
   * @returns {boolean} `true` if a change was detected, or `false` if not.
   */
  async whenRemoteChange() {
    const startSnapshot = this.remoteSnapshot();
    const timeoutAt = Date.now() + REMOTE_CHANGE_TIMEOUT_MSEC;

    // Loop until change detected or timeout.
    for (;;) {
      const now = Date.now();
      if (now >= timeoutAt) {
        break;
      }

      // Wait until the next allowed caret read, or figure out that we don't
      // need to wait at all.
      const readDelay = (this._lastReadTime + READ_DELAY_MSEC) - now;
      if (readDelay > 0) {
        this._log.info(`Pre-read wait in \`whenRemoteChange\`: ${readDelay} msec`);
        // Wait the prescribed amount of time.
        await PromDelay.resolve(readDelay);
      } else {
        // No need to wait. Just indicate that a read should be in progress, and
        // wait for it to be done.
        this._log.info('Waiting for read results in `whenRemoteChange`.');
        await this._needsRead();
      }

      const newSnapshot = this.remoteSnapshot();
      if (!newSnapshot.equals(startSnapshot)) {
        // Yes, there was a change!
        return true;
      }
    }

    // No change detected, and we timed out.
    this._log.info('Timeout reached in `whenRemoteChange`.');
    return false;
  }

  /**
   * Indicates that caret information should be read from file storage. This
   * will ultimately cause such reading to be done.
   *
   * **Note:** This method only returns after the reading is done.
   */
  async _needsRead() {
    if (this._readResultProm === null) {
      this._readResultProm = this._readCarets();
    }

    // Note the current promise, so as to prevent us from messing with the
    // next round of reading.
    const currentProm = this._readResultProm;

    try {
      await currentProm;
    } finally {
      if (this._readResultProm === currentProm) {
        // This round of reading is done, but the promise hasn't yet been reset
        // (either to `null` or to a new promise). `null` it out, so that the
        // next call to `_needsRead()` will in fact kick off a new round of
        // reading.
        this._readResultProm = null;

        // And update the last-read time, so we know when to try reading again.
        this._lastReadTime = Date.now();
      }
    }
  }

  /**
   * Indicates that there is local session data that needs to be written to
   * file storage. This will ultimately cause such writing to be done.
   *
   * **Note:** This method only returns after the writing is done, which to
   * reiterate only happens after a delay. If you want to make a bunch of writes
   * that all end up written (approximately) together, do _not_ `await` the
   * result of this call.
   */
  async _needsWrite() {
    if (this._writeResultProm === null) {
      this._writeResultProm = this._waitThenWriteCarets();
    }

    // Note the current promise, so as to prevent us from messing with the
    // next round of writing.
    const currentProm = this._writeResultProm;

    try {
      await currentProm;
    } finally {
      if (this._writeResultProm === currentProm) {
        // This round of writing is done, but the promise hasn't yet been reset
        // (either to `null` or to a new promise). `null` it out, so that the
        // next call to `_needsWrite()` will in fact kick off a new round of
        // writing.
        this._writeResultProm = null;
      }
    }
  }

  /**
   * Reads carets from storage, updating `_carets` as a result.
   *
   * **Note:** This doesn't update `_storedCarets`, which are the carets as
   * stored from this instance. (That is, those represent carets moving in the
   * other direction from what's being done here.)
   */
  async _readCarets() {
    // **TODO:** For now, we are just reading all carets, always, instead of
    // waiting for changes from the current known state. This should be fixed to
    // use `when*` ops instead, which will avoid this kind of polling behavior.

    // Get a set of all session IDs currently stored.

    this._log.info('Reading caret directory...');

    const fc = this._fileCodec;
    let caretPaths;

    try {
      const spec = new TransactionSpec(
        fc.op_listPath(Paths.CARET_PREFIX));
      const transactionResult = await fc.transact(spec);
      caretPaths = transactionResult.paths;
    } catch (e) {
      this._log.error('Could not read caret directory.', e);
      throw e;
    }

    // Filter out all the sessions that are controlled locally, and read all the
    // the other carets.

    this._log.info('Reading remote carets...');

    const ops = [];
    let caretData;

    for (const path of caretPaths) {
      const sessionId = Paths.sessionFromCaretPath(path);
      if (!this._localSessions.has(sessionId)) {
        ops.push(fc.op_readPath(path));
      }
    }

    if (ops.length === 0) {
      // There aren't any active remote sessions, so there's nothing more to do.
      this._log.info('No remote carets to read.');
      return;
    }

    try {
      const spec = new TransactionSpec(...ops);
      const transactionResult = await fc.transact(spec);
      caretData = transactionResult.data;
    } catch (e) {
      this._log.error('Could not read carets.', e);
      throw e;
    }

    const carets  = this._carets;
    let newCarets = carets;

    for (const c of caretData.values()) {
      newCarets = newCarets.withCaret(c);
    }

    if (carets === newCarets) {
      this._log.info('Done reading carets. No remote changes.');
    } else {
      this._log.info('Done reading carets. Integrated changes.');
      this._carets = newCarets;
    }
  }

  /**
   * Waits a moment, and then writes all locally-controlled carets to file
   * storage.
   *
   * **Note:** This method swallows errors (just reporting them via the log),
   * because ultimately caret sharing is done on a "best effort" basis. We'd
   * rather offer degraded service (i.e. not sharing carets even while other
   * things are working) than hard failure.
   */
  async _waitThenWriteCarets() {
    this._log.detail('Waiting a moment before writing carets.');
    await PromDelay.resolve(WRITE_DELAY_MSEC);

    // Build up a transaction spec to perform all the caret updates, and extract
    // a set of changes to make to instance variables should the transaction
    // succeed. (We have to do this latter part before we `await` the
    // transaction, since otherwise we could be looking at stale state.)

    const fc            = this._fileCodec;
    const ops           = [];
    const updatedCarets = new Map();

    for (const s of this._localSessions) {
      const caret       = this._carets.caretForSession(s);
      const storedCaret = this._storedCarets.caretForSession(s);
      const path        = Paths.forCaret(s);

      if (caret && storedCaret && caret.equals(storedCaret)) {
        // The file already stores this caret info.
        continue;
      }

      if (caret) {
        this._log.detail(`Updating caret: ${s}`);
        ops.push(fc.op_writePath(path, caret));
      } else {
        this._log.detail(`Deleting caret: ${s}`);
        ops.push(fc.op_deletePath(path));
      }

      updatedCarets.set(path, caret);
    }

    if (ops.length === 0) {
      // Nothing got updated, as it turns out.
      this._log.detail('No updated carets to write.');
      return;
    }

    // Run the transaction, retrying a few times on failure.

    const spec = new TransactionSpec(...ops);

    for (let i = 0; i < MAX_WRITE_RETRIES; i++) {
      if (i !== 0) {
        this._log.info(`Caret write attempt #${i+1}.`);
      }

      try {
        this._log.detail('Writing updated carets...');
        await fc.transact(spec);
        this._log.detail('Wrote updated carets.');
        break;
      } catch (e) {
        this._log.warn('Failed to write carets.', e);
      }

      await PromDelay.resolve(WRITE_RETRY_DELAY_MSEC);
    }

    // Update instance variables to reflect the new state of affairs.

    let storedCarets    = this._storedCarets;
    const localSessions = this._localSessions;

    for (const [s, caret] of updatedCarets) {
      if (caret) {
        storedCarets = storedCarets.withCaret(caret);
      } else {
        // The session has ended. In addition to deleting the caret from the
        // file storage model, this removes the session from the set of
        // locally-controlled sessions. This is done because we only ever have
        // to delete a given session from file storage once.
        storedCarets = storedCarets.withoutSession(s);
        localSessions.delete(s);
      }
    }

    this._storedCarets = storedCarets;
    this._log.info('Carets are now updated in storage..');
  }
}
