// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BodyChange, PropertyChange } from '@bayou/doc-common';
import { RevisionNumber, Timestamp } from '@bayou/ot-common';
import { TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import FileComplex from './FileComplex';

/**
 * Server side representative for a session for a specific author and document.
 * Instances of this class are exposed across the API boundary, and as such
 * all public methods are available for client use.
 *
 * For document access methods, this passes non-mutating methods through to the
 * underlying `BodyControl` while implicitly adding an author argument to
 * methods that modify the document.
 */
export default class DocSession extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {fileComplex} fileComplex File complex representing the underlying
   *   file for this instance to use.
   * @param {string} sessionId Session ID for this instance, which is expected
   *   to be guaranteed unique by whatever service it is that generates it.
   * @param {string} authorId The author this instance acts on behalf of.
   */
  constructor(fileComplex, sessionId, authorId) {
    super();

    /** {FileComplex} File complex that this instance is part of. */
    this._fileComplex = FileComplex.check(fileComplex);

    /** {string} Author ID. */
    this._sessionId = TString.nonEmpty(sessionId);

    /** {string} Author ID. */
    this._authorId = TString.nonEmpty(authorId);

    /** {BodyControl} The underlying body content controller. */
    this._bodyControl = fileComplex.bodyControl;

    /** {CaretControl} The underlying caret info controller. */
    this._caretControl = fileComplex.caretControl;

    /** {PropertyControl} The underlying property (metadata) controller. */
    this._propertyControl = fileComplex.propertyControl;
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
   * Applies an update to the document body, assigning authorship of the change
   * to the author represented by this instance and a timestamp which is
   * approximately the current time. See {@link BodyControl#update} for details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {BodyDelta} delta List of operations indicating what has changed
   *   with respect to `baseRevNum`.
   * @returns {BodyChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the document.
   */
  async body_update(baseRevNum, delta) {
    RevisionNumber.check(baseRevNum);

    // **Note:** The change instance gets `baseRevNum + 1` because that's what
    // revision would result if the `delta` were able to be applied directly. If
    // we get "lucky" (win any races) that will be the actual revision number,
    // but the ultimate result might have a higher `revNum`.
    const change = new BodyChange(baseRevNum + 1, delta, Timestamp.now(), this._authorId);

    return this._bodyControl.update(change);
  }

  /**
   * Gets a change of caret information from the indicated base caret revision.
   * This will throw an error if the indicated caret revision isn't available,
   * in which case the client will likely want to use `caret_getSnapshot()` to
   * get back in synch.
   *
   * **Note:** Caret information and the main document have _separate_ revision
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
   * Gets a snapshot of all active session caret information. This will throw an
   * error if the indicated caret revision isn't available.
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
    const change =
      await this._caretControl.changeFor(this._sessionId, docRevNum, index, length);
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
   * Applies an update to the properties (document metadata), assigning
   * authorship of the change to the author represented by this instance and a
   * timestamp which is approximately the current time. See
   * {@link PropertyControl#update} for details.
   *
   * @param {number} baseRevNum Revision number which `delta` is with respect
   *   to.
   * @param {PropertyDelta} delta List of operations indicating what has changed
   *   with respect to `baseRevNum`.
   * @returns {PropertyChange} The correction to the implied expected result of
   *   this operation. The `delta` of this result can be applied to the expected
   *   result to get the actual result. The `timestamp` and `authorId` of the
   *   result will always be `null`. The promise resolves sometime after the
   *   change has been applied to the document.
   */
  async property_update(baseRevNum, delta) {
    RevisionNumber.check(baseRevNum);

    // **Note:** The change instance gets `baseRevNum + 1` because that's what
    // revision would result if the `delta` were able to be applied directly. If
    // we get "lucky" (win any races) that will be the actual revision number,
    // but the ultimate result might have a higher `revNum`.
    const change = new PropertyChange(baseRevNum + 1, delta, Timestamp.now(), this._authorId);

    return this._propertyControl.update(change);
  }

  /**
   * Returns a bit of identifying info about this instance, for the purposes of
   * logging. Specifically, the client side will call this method and log the
   * results during session initiation.
   *
   * @returns {string} A succinct identification string.
   */
  getLogInfo() {
    const file    = this._fileComplex.file.id;
    const session = this._sessionId;
    const author  = this._authorId;

    return `file ${file}; session ${session}; author ${author}`;
  }

  /**
   * Returns the author ID of the user managed by this session.
   *
   * @returns {string} The author ID.
   */
  getAuthorId() {
    return this._authorId;
  }

  /**
   * Returns the document ID of the file controlled by this instance.
   *
   * @returns {string} The document ID.
   */
  getDocumentId() {
    return this._fileComplex.fileAccess.file.id;
  }

  /**
   * Returns the session ID of this instance.
   *
   * @returns {string} The session ID.
   */
  getSessionId() {
    return this._sessionId;
  }
}
