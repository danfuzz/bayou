// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseSession from './BaseSession';

/**
 * Server side representative of a session which allows viewing. Instantiated
 * directly it represents a view-only session, but it also has a subclass,
 * {@link EditSession}.
 *
 * **Note:** Instances of this class _do_ have the ability to affect the caret
 * associated with their session, which _does_ mean that instances can alter
 * file contents but _not_ anything durable (such as most notably the body).
 *
 * For access methods, this passes non-mutating methods through to the
 * underlying `*Control` instances, while implicitly adding author ID and/or
 * caret ID as appropriate to methods that perform modifications.
 */
export default class ViewSession extends BaseSession {
  /**
   * Constructs an instance.
   *
   * @param {FileComplex} fileComplex File complex representing the underlying
   *   file for this instance to use.
   * @param {string} authorId The author this instance acts on behalf of.
   * @param {string} caretId Caret ID for this instance.
   */
  constructor(fileComplex, authorId, caretId) {
    super(fileComplex, authorId, caretId);

    Object.freeze(this);
  }

  /**
   * Returns a particular change to the document body. See the equivalent
   * {@link BodyControl#getChange} for details.
   *
   * @param {Int} revNum The revision number of the change.
   * @returns {BodyChange} The requested change.
   */
  async body_getChange(revNum) {
    return this._bodyControl.getChange(revNum);
  }

  /**
   * Gets a change of the document body from the indicated base revision. See
   * {@link BodyControl#getChangeAfter} for details.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {BodyChange} Delta and associated information.
   */
  async body_getChangeAfter(baseRevNum, timeoutMsec = null) {
    return this._bodyControl.getChangeAfter(baseRevNum, timeoutMsec);
  }

  /**
   * Returns a snapshot of the full document body contents. See
   * {@link BodyControl#snapshot} for details.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {BodySnapshot} The requested snapshot.
   */
  async body_getSnapshot(revNum = null) {
    return this._bodyControl.getSnapshot(revNum);
  }

  /**
   * Gets a change of caret information from the indicated base caret revision.
   * This will throw an error if the indicated caret revision isn't available,
   * in which case the client will likely want to use `caret_getSnapshot()` to
   * get back in synch.
   *
   * **Note:** Caret information and the document body have _separate_ revision
   * numbers. `CaretSnapshot` instances have information about both revision
   * numbers.
   *
   * **Note:** Caret information is only maintained ephemerally, so it is
   * common for it not to be available for other than just a few recent
   * revisions.
   *
   * @param {Int} baseRevNum Revision number for the caret information which
   *   will form the basis for the result. If `baseRevNum` is the current
   *   revision number, this method will block until a new revision is
   *   available.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {CaretDelta} Delta from the base caret revision to a newer one.
   *   Applying this result to a `CaretSnapshot` for `baseRevNum` will produce
   *  an up-to-date snapshot.
   */
  async caret_getChangeAfter(baseRevNum, timeoutMsec = null) {
    return this._caretControl.getChangeAfter(baseRevNum, timeoutMsec);
  }

  /**
   * Gets a snapshot of all active caret information. This will throw an error
   * if the indicated caret revision isn't available.
   *
   * **Note:** Caret information is only maintained ephemerally, so it is
   * common for it not to be available for other than just a few recent
   * revisions.
   *
   * @param {Int|null} [revNum = null] Which caret revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {CaretSnapshot} Snapshot of all the active carets.
   */
  async caret_getSnapshot(revNum = null) {
    return this._caretControl.getSnapshot(revNum);
  }

  /**
   * Informs the system of the client's current caret or text selection extent.
   * This should be called by clients when they notice user activity that
   * changes the selection. More specifically, Quill's `selection-change`
   * events are expected to drive calls to this method. The `index` and `length`
   * arguments to this method have the same semantics as they have in Quill,
   * that is, they ultimately refer to an extent within a Quill `Delta`.
   *
   * @param {Int} docRevNum The _document_ revision number that this information
   *   is with respect to.
   * @param {Int} index Caret position (if no selection per se) or starting
   *   caret position of the selection.
   * @param {Int} [length = 0] If non-zero, length of the selection.
   * @returns {CaretChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the caret state.
   */
  async caret_update(docRevNum, index, length = 0) {
    const snapshot = await this._caretControl.getSnapshot();

    if (snapshot.getOrNull(this._caretId) === null) {
      // The caret isn't actually represented in the caret snapshot. This is
      // unexpected -- the code which sets up a session is supposed to ensure
      // that the associated caret is represented in the file before the client
      // ever has a chance to send an update -- but we can recover: We note the
      // issue as a warning, and store a new caret first, before applying the
      // update.
      const newSessionChange =
        await this._caretControl.changeForNewCaret(this._caretId, this._authorId);

      this._caretControl.log.warn(`Got update for caret \`${this._caretId}\` before it was set up.`);

      // **TODO:** This should possibly have the same kind of race-loss-retry
      // logic as seen elsewhere in the codebase. However, for now -- and
      // perhaps forever -- this is probably fine, because this whole situation
      // isn't ever supposed to happen anyway.
      await this._caretControl.update(newSessionChange);
    }

    const change =
      await this._caretControl.changeForUpdate(this._caretId, docRevNum, index, length);
    return this._caretControl.update(change);
  }

  /**
   * Returns a particular change to the properties (document metadata). See
   * {@link PropertyControl#getChange} for details.
   *
   * @param {Int} revNum The revision number of the change.
   * @returns {PropertyChange} The requested change.
   */
  async property_getChange(revNum) {
    return this._propertyControl.getChange(revNum);
  }

  /**
   * Gets a change of the properties (document metadata) from the indicated base
   * revision. See {@link PropertyControl#getChangeAfter} for details.
   *
   * @param {Int} baseRevNum Revision number for the document.
   * @param {Int|null} [timeoutMsec = null] Maximum amount of time to allow in
   *   this call, in msec. This value will be silently clamped to the allowable
   *   range as defined by {@link Timeouts}. `null` is treated as the maximum
   *   allowed value.
   * @returns {PropertyChange} Delta and associated information.
   */
  async property_getChangeAfter(baseRevNum, timeoutMsec = null) {
    return this._propertyControl.getChangeAfter(baseRevNum, timeoutMsec);
  }

  /**
   * Returns a snapshot of the properties (document metadata). See
   * {@link PropertyControl#snapshot} for details.
   *
   * @param {Int|null} [revNum = null] Which revision to get. If passed as
   *   `null`, indicates the latest (most recent) revision.
   * @returns {PropertySnapshot} The requested snapshot.
   */
  async property_getSnapshot(revNum = null) {
    return this._propertyControl.getSnapshot(revNum);
  }

  /**
   * Subclass-specific implementation which underlies {@link #canEdit}.
   *
   * @returns {boolean} `false`, always.
   */
  _impl_canEdit() {
    return false;
  }
}
