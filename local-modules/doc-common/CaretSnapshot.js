// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray } from 'typecheck';
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
   * @param {array<Caret>} carets Array of all the active carets.
   */
  constructor(revNum, docRevNum, carets) {
    super();

    /** {Int} The associated caret information revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {Int} The associated document information revision number. */
    this._docRevNum = RevisionNumber.check(docRevNum);

    /** {array<Caret>} Array of all the active carets. */
    this._carets = Object.freeze(TArray.check(carets, Caret.check));

    Object.freeze(this);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._docRevNum, this._carets];
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
    return this._carets;
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

    const sessions = new Map();

    for (const caret of this._carets) {
      sessions.set(caret.sessionId, caret);
    }

    for (const op of delta.ops) {
      const sessionId = op.args.get('sessionId');

      switch (op.name) {
        case CaretOp.BEGIN_AUTHOR_SESSION_OP:
          // Nothing to do here
          break;

        case CaretOp.UPDATE_AUTHOR_SELECTION_OP:
          sessions.set(sessionId, new Caret(
            sessionId,
            op.get('index'),
            op.get('length'),
            op.get('color')
          ));
          break;

        case CaretOp.END_AUTHOR_SESSION_OP:
          sessions.delete(sessionId);
          break;
      }
    }

    return new CaretSnapshot(this.docRevNum, delta.revNum, sessions.values());
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

    const caretsAdded = [];
    const caretsUpdated = [];
    const caretsRemoved = [];

    for (const newerCaret of newerSnapshot.carets) {
      const sessionId = newerCaret.sessionId;

      if (this.carets.some((caret) => {
        return caret.sessionId === sessionId;
      })) {
        // If a `sessionId` matches between the two snapshots then it's an update.
        caretsUpdated.push(newerCaret);
      } else {
        // If `sessionId` is in `newerSnapshot` but not `this` then its a addition.
        caretsAdded.push(newerCaret);
      }
    }

    // Finally, find carets removed from `this` when going to `newerSnapshot`
    for (const oldCaret of this.carets) {
      const sessionId = oldCaret.sessionId;

      if (!newerSnapshot.carets.some((caret) => {
        return caret.sessionId === sessionId;
      })) {
        caretsRemoved.push(oldCaret);
      }
    }

    const revNum = Math.max(this.revNum, newerSnapshot.revNum);
    const caretOps = [];

    for (const caret of caretsAdded) {
      caretOps.push(CaretDelta.op_addAuthor(caret.sessionId));
    }

    for (const caret of caretsUpdated) {
      caretOps.push(CaretDelta.op_updateAuthorSelecton(caret.sessionId, caret.index, caret.length, caret.color));
    }

    for (const caret of caretsRemoved) {
      caretOps.push(CaretDelta.op_removeAuthor(caret.sessionId));
    }

    return new CaretDelta(revNum, caretOps);
  }
}
