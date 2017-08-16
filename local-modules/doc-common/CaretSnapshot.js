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
   * @param {Iterable<Caret>} carets Iterable of all the active carets. This
   *   constructor will iterate with it exactly once.
   */
  constructor(revNum, carets) {
    RevisionNumber.check(revNum);
    TIterable.check(carets);

    super();

    /** {Int} The associated caret information revision number. */
    this._revNum = revNum;

    /** {Map<string, Caret>} Map of session ID to corresponding caret. */
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
    return [this._revNum, [...this._carets.values()]];
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
    let   revNum    = this._revNum;

    for (const op of delta.ops) {
      switch (op.name) {
        case CaretOp.BEGIN_SESSION: {
          const caret = op.arg('caret');
          newCarets.set(caret.sessionId, caret);
          break;
        }

        case CaretOp.UPDATE_FIELD: {
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

        case CaretOp.UPDATE_REV_NUM: {
          revNum = op.arg('revNum');
          break;
        }
      }
    }

    return new CaretSnapshot(revNum, newCarets.values());
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
        caretOps.push(CaretOp.op_beginSession(newerCaret));
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

  /**
   * Constructs an instance just like this one, except with an additional or
   * updated reference to the indicated caret. If the given caret (including all
   * fields) is already represented in this instance, this method returns
   * `this`.
   *
   * @param {Caret} caret The caret to include in the result.
   * @returns {CaretSnapshot} An appropriately-constructed instance.
   */
  withCaret(caret) {
    Caret.check(caret);
    const sessionId = caret.sessionId;
    const carets    = this._carets;
    const already   = carets.get(sessionId);

    if (already && already.equals(caret)) {
      return this;
    }

    const newCarets = new Map(carets);
    newCarets.set(sessionId, caret);

    return new CaretSnapshot(this._revNum, newCarets.values());
  }

  /**
   * Constructs an instance just like this one, except with a different
   * caret revision number. If the given revision number is the same as what
   * this instance already stores, this method returns `this`.
   *
   * @param {Int} revNum The new caret revision number.
   * @returns {CaretSnapshot} An appropriately-constructed instance.
   */
  withRevNum(revNum) {
    RevisionNumber.check(revNum);

    return (revNum === this._revNum)
      ? this
      : new CaretSnapshot(revNum, this._carets.values());
  }

  /**
   * Constructs an instance just like this one, except without any reference to
   * the session indicated by the given caret. If there is no session for the
   * given caret, this method returns `this`.
   *
   * @param {Caret} caret The caret whose session should not be represented in
   *   the result. Only the `sessionId` of the caret is consulted; it doesn't
   *   matter if other caret fields match.
   * @returns {CaretSnapshot} An appropriately-constructed instance.
   */
  withoutCaret(caret) {
    Caret.check(caret);
    const sessionId = caret.sessionId;
    const carets    = this._carets;

    if (!carets.has(sessionId)) {
      return this;
    }

    const newCarets = new Map(carets);
    newCarets.delete(sessionId);

    return new CaretSnapshot(this._revNum, newCarets.values());
  }
}
