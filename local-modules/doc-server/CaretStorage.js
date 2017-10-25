// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Caret, CaretSnapshot } from 'doc-common';
import { TransactionSpec } from 'file-store';
import { CallPiler, Delay } from 'promise-util';
import { TString } from 'typecheck';
import { Errors, FrozenBuffer } from 'util-common';

import BaseComplexMember from './BaseComplexMember';
import Paths from './Paths';

/**
 * {Int} Maximum amount of time that a call to `whenRemoteChange()` will take
 * before timing out.
 */
const REMOTE_CHANGE_TIMEOUT_MSEC = 5 * 60 * 1000; // Five minutes.

/**
 * {Int} How long to wait (in msec) after sessions are updated before an attempt
 * is made to write session info to file storage. This keeps the system from
 * storing too many ephemeral session updates, with the downside that caret
 * sharing across servers has this much more latency than sharing between
 * sessions that reside on the same machine.
 */
const WRITE_DELAY_MSEC = 10 * 1000; // Ten seconds.

/** {Int} How long (in msec) to wait between write retries. */
const WRITE_RETRY_DELAY_MSEC = 30 * 1000; // 30 seconds.

/** {Int} How many times to retry writes. */
const MAX_WRITE_RETRIES = 5;

/**
 * Helper class for `CaretControl` which handles the underlying file storage of
 * caret information. Every caret that gets updated or removed via the public
 * methods on this class is considered to be "locally controlled," and so such
 * caret updates are pushed to the file storage.
 */
export default class CaretStorage extends BaseComplexMember {
  /**
   * Constructs an instance.
   *
   * @param {FileAccess} fileAccess Low-level file access and related
   *   miscellanea.
   */
  constructor(fileAccess) {
    super(fileAccess);

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
     * {string|null} The latest value read from the caret set update flag, or
     * `null` if it has never been read. This is used to notice when the set of
     * active sessions changes due to the activity of other servers. See
     * {@link #_waitThenWriteCarets} below for more info.
     */
    this._caretSetUpdate = null;

    /**
     * {Int} Last time (in msec since the Unix Epoch) that carets were read
     * from storage.
     */
    this._lastReadTime = 0;

    /**
     * {CallPiler} Call piler which fronts `whenRemoteChange()`, so there's only
     * ever one call to it ongoing at any given time.
     */
    this._whenRemoteChangePiler =
      new CallPiler(this._whenRemoteChange.bind(this));

    /** {CallPiler} Call piler for performing writes to storage. */
    this._writePiler = new CallPiler(this._waitThenWriteCarets.bind(this));

    Object.seal(this);
  }

  /**
   * Deletes a locally-controlled session. This update will eventually get
   * written to file storage (unless superseded by another change to the same
   * session in the meantime).
   *
   * @param {string} sessionId ID of the session to be deleted.
   */
  delete(sessionId) {
    TString.nonEmpty(sessionId);

    // Indicate that the local server is asserting authority over this session.
    // This means that, when it comes time to write out caret info, this session
    // will be removed from file storage.
    this._localSessions.add(sessionId);

    this._carets = this._carets.withoutSession(sessionId);
    this._needsWrite();
  }

  /**
   * Takes a caret snapshot which is expected to be a mix of locally-controlled
   * and remote carets, and updates just the remote carets to the most recent
   * known state. If there are no remote updates, this method returns the
   * originally-passed snapshot.
   *
   * This method doesn't wait for data to be read from storage; it always
   * returns immediately with whatever info is at hand. To get the remote data
   * to become updated, it is necessary to call `whenRemoteChange()`.
   *
   * @param {CaretSnapshot} snapshot Caret snapshot to update.
   * @returns {CaretSnapshot} `snapshot` with all known remote updates applied,
   *   if any.
   */
  integrateRemotes(snapshot) {
    const carets = this._carets;

    // Remove any caret that isn't represented in this instance. Such carets are
    // remote carets for sessions that have since been deleted.
    for (const [sessionId, caret_unused] of snapshot.entries()) {
      if (!carets.has(sessionId)) {
        const newSnapshot = snapshot.withoutSession(sessionId);
        if (newSnapshot !== snapshot) {
          snapshot = newSnapshot;
          this.log.detail('Integrated caret removal:', sessionId);
        }
      }
    }

    // Update all the remote carets.
    for (const sessionId of this._remoteSessionIds()) {
      const newSnapshot = snapshot.withCaret(carets.get(sessionId));
      if (newSnapshot !== snapshot) {
        snapshot = newSnapshot;
        this.log.detail('Integrated caret update:', sessionId);
      }
    }

    return snapshot;
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
   * change has been detected, or after the request times out. If indeed a
   * change was detected, by the time this method returns, calls to
   * `integrateRemoteCarets()` will reflect the updated information.
   *
   * @returns {boolean} `true` if a change was detected, or `false` if not.
   */
  async whenRemoteChange() {
    // This just passes through to the main method implementation, via a call
    // piler which guarantees that only one such call is running at any given
    // time, sharing the return value with all concurrent callers.
    return this._whenRemoteChangePiler.call();
  }

  /**
   * Subclass-specific implementation of {@link #validationStatus}. In this
   * case, it returns `null` because this class doesn't do validation. (Caret
   * validation is handled by {@link CaretContro}.)
   *
   * @returns {object} `null`, always.
   */
  async _impl_validationStatus() {
    return null;
  }

  /**
   * Indicates that there is local session data that needs to be written to
   * file storage. This will ultimately cause such writing to be done.
   *
   * **Note:** This method only returns after the writing is done, which to
   * reiterate only happens after a delay. If you want to make a bunch of writes
   * that all end up written (approximately) together, do _not_ `await` the
   * result of this call.
   *
   * @returns {undefined} `undefined` upon completion.
   */
  async _needsWrite() {
    return this._writePiler.call();
  }

  /**
   * Helper for `_whenRemoteChange()`, which handles the case of the caret set
   * changing. That is, this is what we do when we've detected that at least one
   * remote session has been created or deleted. This method adds all the new
   * sessions and removes all the deleted sessions from our local caret
   * snapshot.
   */
  async _readAllChangedSessions() {
    this.log.info('Reading caret directory...');

    const fc                = this.fileCodec;
    const currentSessionIds = new Set();

    try {
      const spec = new TransactionSpec(
        fc.op_listPathPrefix(Paths.CARET_SESSION_PREFIX));
      const transactionResult = await fc.transact(spec);
      for (const p of transactionResult.paths) {
        currentSessionIds.add(Paths.sessionFromCaretPath(p));
      }
    } catch (e) {
      this.log.error('Could not read caret directory.', e);
      throw e;
    }

    // Read all the carets for sessions that are new to us, as well as the
    // current "set update" value.

    const ops = [];
    let caretData;

    for (const sessionId of currentSessionIds) {
      if (!this._carets.has(sessionId)) {
        this.log.info('New remote caret:', sessionId);
        ops.push(fc.op_readPath(Paths.forCaret(sessionId)));
      }
    }

    ops.push(fc.op_readPath(Paths.CARET_SET_UPDATE_FLAG));

    try {
      const spec = new TransactionSpec(...ops);
      const transactionResult = await fc.transact(spec);
      caretData = transactionResult.data;
    } catch (e) {
      this.log.error('Could not read new carets.', e);
      throw e;
    }

    // Update our caret snapshot: Add all of the new carets, remove all the
    // carets for remote sessions that have gone away, and note the lastest "set
    // update" value.

    let carets = this._carets;

    for (const [path, v] of caretData) {
      if (path === Paths.CARET_SET_UPDATE_FLAG) {
        this._caretSetUpdate = v;
      } else {
        carets = carets.withCaret(v);
      }
    }

    for (const sessionId of this._remoteSessionIds()) {
      if (!currentSessionIds.has(sessionId)) {
        this.log.info('Remote caret has gone away:', sessionId);
        carets = carets.withoutSession(sessionId);
      }
    }

    this._carets = carets;
  }

  /**
   * Reads and integrates the caret data for the given set of paths, each of
   * which must correspond to a caret session.
   *
   * @param {Set<string>} paths Set of paths, one per caret to read.
   */
  async _readCaretsFor(paths) {
    const fc  = this.fileCodec;
    const ops = [];
    let caretData;

    for (const p of paths) {
      this.log.info('Remote caret changed:', Paths.sessionFromCaretPath(p));
      ops.push(fc.op_readPath(p));
    }

    try {
      this.log.info('Reading changed carets.');
      const transactionResult = await fc.transact(new TransactionSpec(...ops));
      caretData = transactionResult.data;
    } catch (e) {
      this.log.error('Could not read changed carets.', e);
      throw e;
    }

    let carets = this._carets;

    for (const c of caretData.values()) {
      carets = carets.withCaret(c);
    }

    this._carets = carets;
  }

  /**
   * Gets a list of the currently-known remote session IDs. This returns the
   * information that is on hand and does not initiate any storage requests.
   *
   * @returns {array<string>} Array of the session IDs in question.
   */
  _remoteSessionIds() {
    const result = [];

    for (const [sessionId, caret_unused] of this._carets.entries()) {
      if (!this._localSessions.has(sessionId)) {
        result.push(sessionId);
      }
    }

    return result;
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
    this.log.detail('Waiting a moment before writing carets.');
    await Delay.resolve(WRITE_DELAY_MSEC);

    // Build up a transaction spec to perform all the caret updates, and extract
    // a set of changes to make to instance variables should the transaction
    // succeed. (We have to do this latter part before we `await` the
    // transaction, since otherwise we could be looking at stale state.)

    const fc            = this.fileCodec;
    const ops           = [];
    const updatedCarets = new Map();
    const setUpdates    = []; // List of new and deleted sessions.

    for (const sessionId of this._localSessions) {
      const caret       = this._carets.getOrNull(sessionId);
      const storedCaret = this._storedCarets.getOrNull(sessionId);
      const path        = Paths.forCaret(sessionId);

      if (caret && storedCaret && caret.equals(storedCaret)) {
        // The file already stores this caret info.
        continue;
      }

      if (caret) {
        this.log.detail('Updating caret:', sessionId);
        ops.push(fc.op_writePath(path, caret));
        if (!storedCaret) {
          // First time this session is being stored.
          setUpdates.push(sessionId);
        }
      } else {
        this.log.detail('Deleting caret:', sessionId);
        ops.push(fc.op_deletePath(path));
        setUpdates.push(sessionId);
      }

      updatedCarets.set(sessionId, caret);
    }

    if (ops.length === 0) {
      // Nothing got updated, as it turns out.
      this.log.detail('No updated carets to write.');
      return;
    }

    // Construct a set update op, if necessary. This is used to trigger readers
    // into refreshing the set of sessions. This is done by noticing when the
    // contents stored at the set update path change, to anything different. We
    // also store the new update flag in `_caretSetUpdate`, so that the change
    // detection code doesn't incorrectly detect a remote change when it's
    // actually this server that made it.
    //
    // We guarantee differentness of the stored value by constructing it as a
    // hash of all of the session IDs which have changed membership, a value
    // which is vanishingly unlikely to collide with any other possible hash
    // generated from such activity on other servers. We do it this way instead
    // of just incrementing a counter because a counter increment could get
    // messed up due to an asynchrony hazard. (That said, we could have instead
    // used a long-enough random number. The rationale against that is a bit
    // less solid, but boils down to it being better for this code to be fully
    // deterministic.)

    if (setUpdates.length !== 0) {
      const caretSetUpdate = new FrozenBuffer(setUpdates.join(',')).hash;
      this._caretSetUpdate = caretSetUpdate;
      ops.push(fc.op_writePath(Paths.CARET_SET_UPDATE_FLAG, caretSetUpdate));
    }

    // Run the transaction, retrying a few times on failure.

    const spec = new TransactionSpec(...ops);

    for (let i = 0; i < MAX_WRITE_RETRIES; i++) {
      if (i !== 0) {
        this.log.info(`Caret write attempt #${i+1}.`);
      }

      try {
        this.log.detail('Writing updated carets...');
        await fc.transact(spec);
        this.log.detail('Wrote updated carets.');
        break;
      } catch (e) {
        this.log.warn('Failed to write carets.', e);
        if (i === MAX_WRITE_RETRIES) {
          // This was the last attempt. Log it as an error (but don't rethrow,
          // per the rationale in the header comment). And return from the
          // method (instead of continuing below), so that we don't incorrectly
          // indicate that the stuff we were trying to store was actually
          // stored.
          this.log.error('Failed to write carets, too many times.', e);
          return;
        } else {
          this.log.warn('Failed to write carets.', e);
        }
      }

      await Delay.resolve(WRITE_RETRY_DELAY_MSEC);
    }

    // Update instance variables to reflect the new state of affairs.

    let storedCarets    = this._storedCarets;
    const localSessions = this._localSessions;

    for (const [sessionId, caret] of updatedCarets) {
      if (caret) {
        storedCarets = storedCarets.withCaret(caret);
      } else {
        // The session has ended. In addition to deleting the caret from the
        // file storage model, this removes the session from the set of
        // locally-controlled sessions. This is done because we only ever have
        // to delete a given session from file storage once.
        storedCarets = storedCarets.withoutSession(sessionId);
        localSessions.delete(sessionId);
      }
    }

    this._storedCarets = storedCarets;
    this.log.info('Carets are now updated in storage.');
  }

  /**
   * Main implementation of `whenRemoteChange()`, see which for details.
   *
   * @returns {boolean} `true` if a change was detected, or `false` if not.
   */
  async _whenRemoteChange() {
    // Build up the change detection transaction spec.

    const fc  = this.fileCodec;
    const ops = [];

    ops.push(fc.op_timeout(REMOTE_CHANGE_TIMEOUT_MSEC));

    // Detects when there are new or removed sessions.
    if (this._caretSetUpdate === null) {
      ops.push(fc.op_whenPathPresent(Paths.CARET_SET_UPDATE_FLAG));
    } else {
      ops.push(fc.op_whenPathNot(Paths.CARET_SET_UPDATE_FLAG, this._caretSetUpdate));
    }

    // Detects changes to any of the already-known remote sessions.
    for (const sessionId of this._remoteSessionIds()) {
      const caret = this._carets.get(sessionId);
      ops.push(fc.op_whenPathNot(Paths.forCaret(sessionId), caret));
    }

    // Run the transaction. It will return either when a change is detected or
    // the specified timeout passes.

    let paths;
    try {
      this.log.info('Waiting for caret changes.');
      const transactionResult = await fc.transact(new TransactionSpec(...ops));
      paths = transactionResult.paths;
    } catch (e) {
      if (Errors.isTimeout(e)) {
        // Per the method doc, we convert timeout into a `false` return.
        this.log.info('Timed out while waiting for caret changes.');
        return false;
      } else {
        // Not a timeout; re-throw.
        throw e;
      }
    }

    // Change was detected. Read all the changed carets, and update local state.

    if (paths.has(Paths.CARET_SET_UPDATE_FLAG)) {
      await this._readAllChangedSessions();
      paths.delete(Paths.CARET_SET_UPDATE_FLAG);
    }

    if (paths.size !== 0) {
      await this._readCaretsFor(paths);
    }

    this.log.info('Integrated newly-changed remote carets.');

    return true;
  }
}
