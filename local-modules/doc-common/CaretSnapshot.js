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
   * **Note:** It is an error if `delta` contains an `op_updateField` to a caret
   * that either does not exist in `this` or was not first introduced with an
   * `op_beginSession`.
   *
   * @param {CaretDelta} delta Delta to compose on top of this instance.
   * @returns {CaretSnapshot} New instance consisting of the composition of
   *   this instance with `delta`.
   */
  compose(delta) {
    CaretDelta.check(delta);

    const newCarets = new Map(this._carets.entries());
    let   docRevNum = this._docRevNum;
    let   revNum    = this._revNum;

    for (const op of delta.ops) {
      switch (op.name) {
        case CaretOp.BEGIN_SESSION: {
          const sessionId = op.arg('sessionId');
          newCarets.set(sessionId, new Caret(sessionId));
          break;
        }

        case CaretOp.UPDATE_CARET: {
          const caret     = op.arg('caret');
          const sessionId = caret.sessionId;

          if (!newCarets.get(sessionId)) {
            throw new Error(`Invalid delta; update to nonexistent caret: ${sessionId}`);
          }

          newCarets.set(sessionId, caret);
          break;
        }

        case CaretOp.UPDATE_CARET_FIELD: {
          const sessionId = op.arg('sessionId');
          const caret     = newCarets.get(sessionId);

          if (!caret) {
            throw new Error(`Invalid delta; update to nonexistent caret: ${sessionId}`);
          }

          newCarets.set(sessionId, caret.compose(new CaretDelta([op])));
          break;
        }

        case CaretOp.END_SESSION: {
          const sessionId = op.arg('sessionId');
          newCarets.delete(sessionId);
          break;
        }

        case CaretOp.UPDATE_DOC_REV_NUM: {
          docRevNum = op.arg('docRevNum');
          break;
        }

        case CaretOp.UPDATE_REV_NUM: {
          revNum = op.arg('revNum');
          break;
        }
      }
    }

    return new CaretSnapshot(revNum, docRevNum, newCarets.values());
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a delta which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerSnapshot ==
   * this.compose(this.diff(newerSnapshot))`.
   *
   * **Note:** The word `newer` in the argument name is meant to be suggestive
   * of typical usage of this method, but there is no actual requirement that
   * the argument be strictly newer in any sense, compared to the instance this
   * method is called on.
   *
   * @param {CaretSnapshot} newerSnapshot Snapshot to take the difference from.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  diff(newerSnapshot) {
    CaretSnapshot.check(newerSnapshot);

    const newerCarets = newerSnapshot._carets;
    const caretOps    = [];

    // Add ops for the revision numbers, as needed.

    if (this._revNum !== newerSnapshot._revNum) {
      caretOps.push(CaretOp.op_updateRevNum(newerSnapshot._revNum));
    }

    if (this._docRevNum !== newerSnapshot._docRevNum) {
      caretOps.push(CaretOp.op_updateDocRevNum(newerSnapshot._docRevNum));
    }

    // Find carets that are new or updated from `this` when going to
    // `newerSnapshot`.

    for (const [sessionId, newerCaret] of newerCarets) {
      const already = this._carets.get(sessionId);
      if (already) {
        // The `sessionId` matches the older snapshot. Indicate an update if the
        // values are different.
        if (!already.equals(newerCaret)) {
          const diff = already.diff(newerCaret);
          for (const op of diff.ops) {
            caretOps.push(op);
          }
        }
      } else {
        // The `sessionId` isn't in the older snapshot, so this is an addition.
        caretOps.push(CaretOp.op_beginSession(sessionId));

        const diff = Caret.EMPTY.diffFields(newerCaret, sessionId);
        for (const op of diff.ops) {
          caretOps.push(op);
        }
      }
    }

    // Find carets removed from `this` when going to `newerSnapshot`.

    for (const [sessionId, olderCaret] of this._carets) {
      if (!newerCarets.get(sessionId)) {
        caretOps.push(CaretOp.op_endSession(olderCaret.sessionId));
      }
    }

    // Build the result.
    return new CaretDelta(caretOps);
  }

  /**
   * Compares this to another instance, for equality of content.
   *
   * @param {CaretSnapshot} other Snapshot to compare to.
   * @returns {boolean} `true` iff `this` and `other` have equal contents.
   */
  equals(other) {
    CaretSnapshot.check(other);

    const thisCarets  = this._carets;
    const otherCarets = other._carets;

    if (   (this._revNum    !== other._revNum)
        || (this._docRevNum !== other._docRevNum)
        || (thisCarets.size !== otherCarets.size)) {
      return false;
    }

    for (const [sessionId, thisCaret] of thisCarets) {
      const otherCaret = otherCarets.get(sessionId);
      if (!(otherCaret && otherCaret.equals(thisCaret))) {
        return false;
      }
    }

    return true;
  }
}
