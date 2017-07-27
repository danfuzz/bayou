// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TIterable } from 'typecheck';
import { CommonBase } from 'util-common';

import Caret from './Caret';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import RevisionNumber from './RevisionNumber';

/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 */
export default class CaretSnapshot extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information.
   * @param {Int} docRevNum Revision number of the document to which the caret
   *   information applies.
   * @param {Iterable<Caret>} carets Iterable of all the active carets. This
   *   constructor will iterate with it exactly once.
   */
  constructor(revNum, docRevNum, carets) {
    RevisionNumber.check(revNum);
    RevisionNumber.check(docRevNum);
    TIterable.check(carets);

    super();

    /** {Int} The associated caret information revision number. */
    this._revNum = revNum;

    /** {Int} The associated document information revision number. */
    this._docRevNum = docRevNum;

    /** {Map<string,Caret>} Map of session ID to corresponding caret. */
    this._carets = new Map();
    for (const c of carets) {
      Caret.check(c);
      this._carets.set(c.sessionId, c);
    }

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._docRevNum, [...this._carets.values()]];
  }

  /**
   * {Int} The document revision number to which the caret information applies.
   */
  get docRevNum() {
    return this._docRevNum;
  }

  /** {Int} The caret information revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {array<Caret>} Array of active carets. It is guaranteed to be a frozen
   * (immutable) value.
   */
  get carets() {
    return Object.freeze([...this._carets.values()]);
  }

  /**
   * Gets the caret info for the given session, if any.
   *
   * @param {string} sessionId Session in question.
   * @returns {Caret|null} Corresponding caret, or `null` if there is none.
   */
  caretForSession(sessionId) {
    return this._carets.get(sessionId) || null;
  }

  /**
   * Composes a delta on top of this instance, to produce a new instance.
   *
   * @param {CaretDelta} delta Delta to compose on top of this instance.
   * @returns {CaretSnapshot} New instance consisting of the composition of
   *   this instance with `delta`.
   */
  compose(delta) {
    CaretDelta.check(delta);

    const newCarets = new Map(this._carets.entries());
    let docRevNum = this.docRevNum;

    for (const op of delta.ops) {
      switch (op.name) {
        case CaretOp.BEGIN_SESSION: {
          // Nothing to do here.
          break;
        }

        case CaretOp.UPDATE_CARET: {
          const caret = op.arg('caret');
          newCarets.set(caret.sessionId, caret);
          break;
        }

        case CaretOp.END_SESSION: {
          const sessionId = op.arg('sessionId');
          newCarets.delete(sessionId);
          break;
        }

        case CaretOp.UPDATE_DOC_REV_NUM: {
          docRevNum = op.arg('docRevNum');
        }
      }
    }

    return new CaretSnapshot(docRevNum, delta.revNum, newCarets.values());
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a delta which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerSnapshot ==
   * this.compose(this.diff(newerSnapshot))`.
   *
   * @param {CaretSnapshot} newerSnapshot Snapshot to take the difference from.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  diff(newerSnapshot) {
    CaretSnapshot.check(newerSnapshot);

    const newerCarets   = newerSnapshot._carets;
    const caretsAdded   = [];
    const caretsUpdated = [];
    const caretsRemoved = [];

    // Find carets that are new or updated from `this` when going to
    // `newerSnapshot`.
    for (const [sessionId, newerCaret] of newerCarets) {
      if (!this._carets.get(sessionId)) {
        // The `sessionId` isn't in the older snapshot, so this is an addition.
        caretsAdded.push(newerCaret);
      }
      caretsUpdated.push(newerCaret);
    }

    // Finally, find carets removed from `this` when going to `newerSnapshot`.
    for (const [sessionId, olderCaret] of this._carets) {
      if (!newerCarets.get(sessionId)) {
        caretsRemoved.push(olderCaret);
      }
    }

    const revNum = Math.max(this.revNum, newerSnapshot.revNum);
    const caretOps = [];

    for (const caret of caretsAdded) {
      caretOps.push(CaretDelta.op_beginSession(caret.sessionId));
    }

    for (const caret of caretsUpdated) {
      caretOps.push(CaretDelta.op_updateCaret(caret));
    }

    for (const caret of caretsRemoved) {
      caretOps.push(CaretDelta.op_endSession(caret.sessionId));
    }

    if (this.docRevNum !== newerSnapshot.docRevNum) {
      caretOps.push(CaretDelta.op_updateDocRevNum(newerSnapshot.docRevNum));
    }

    return new CaretDelta(revNum, caretOps);
  }
}
