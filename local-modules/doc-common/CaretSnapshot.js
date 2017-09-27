// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { CommonBase, Errors } from 'util-common';

import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';
import RevisionNumber from './RevisionNumber';

/**
 * {CaretSnapshot|null} Empty instance. Initialized in the `EMPTY` property
 * accessor.
 */
let EMPTY = null;

/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 */
export default class CaretSnapshot extends CommonBase {
  /**
   * {CaretSnapshot} Empty instance of this class. It has no carets and a
   * revision number of `0`.
   */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new CaretSnapshot(0, []);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information.
   * @param {CaretDelta|array<CaretOp>} delta A from-empty delta (or array of
   *   ops which can be used to construct same), representing all the carets to
   *   include in the instance.
   */
  constructor(revNum, delta) {
    if (Array.isArray(delta)) {
      // Convert the given array into a proper delta instance. (This does type
      // checking of the argument.)
      delta = new CaretDelta(delta);
    } else {
      CaretDelta.check(delta);
    }

    super();

    /** {Int} The caret information revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /**
     * {Map<string, CaretOp>} Map of session ID to an `op_beginSession` which
     * defines the caret for that session.
     */
    this._carets = new Map();

    // Fill in `_carets`.
    for (const op of delta.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.BEGIN_SESSION: {
          const sessionId = opProps.caret.sessionId;

          if (this._carets.has(sessionId)) {
            throw Errors.bad_use(`Duplicate caret: ${sessionId}`);
          }

          this._carets.set(sessionId, op);
          break;
        }

        default: {
          throw Errors.bad_value(op, 'CaretSnapshot construction op');
        }
      }
    }

    Object.freeze(this._carets);
    Object.freeze(this);
  }

  /** {CaretDelta} The document contents as a from-empty delta. */
  get contents() {
    return new CaretDelta([...this._carets.values()]);
  }

  /**
   * {array<Caret>} Array of active carets. It is guaranteed to be a frozen
   * (immutable) value.
   */
  get carets() {
    const result = [];

    for (const op of this._carets.values()) {
      result.push(op.props.caret);
    }

    return Object.freeze(result);
  }

  /** {Int} The caret information revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {array<string>} Array of session IDs for all active carets. It is
   * guaranteed to be a frozen (immutable) value.
   */
  get sessionIds() {
    return Object.freeze([...this._carets.keys()]);
  }

  /**
   * Gets the caret info for the given session, if any.
   *
   * @param {string} sessionId Session in question.
   * @returns {Caret|null} Corresponding caret, or `null` if there is none.
   */
  caretForSession(sessionId) {
    TString.nonEmpty(sessionId);

    const found = this._carets.get(sessionId);

    return found ? found.props.caret : null;
  }

  /**
   * Composes a change on top of this instance, to produce a new instance.
   *
   * **Note:** It is an error if `change` contains an `op_setField` to a caret
   * that either does not exist in `this` or was not first introduced with an
   * `op_beginSession`.
   *
   * @param {CaretChange} change Changeto compose on top of this instance.
   * @returns {CaretSnapshot} New instance consisting of the composition of
   *   this instance with `change`.
   */
  compose(change) {
    CaretChange.check(change);

    const newCarets = new Map(this._carets);

    for (const op of change.delta.ops) {
      const props = op.props;

      switch (props.opName) {
        case CaretOp.BEGIN_SESSION: {
          const caret = props.caret;
          newCarets.set(caret.sessionId, op);
          break;
        }

        case CaretOp.SET_FIELD: {
          const sessionId = props.sessionId;
          const caretOp   = newCarets.get(sessionId);

          if (!caretOp) {
            throw Errors.bad_use(`Cannot update nonexistent caret: ${sessionId}`);
          }

          const caret = caretOp.props.caret.compose(new CaretDelta([op]));
          newCarets.set(sessionId, CaretOp.op_beginSession(caret));
          break;
        }

        case CaretOp.END_SESSION: {
          const sessionId = props.sessionId;
          newCarets.delete(sessionId);
          break;
        }

        default: {
          throw Errors.wtf(`Weird caret op: ${props.opName}`);
        }
      }
    }

    return new CaretSnapshot(change.revNum, [...newCarets.values()]);
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a change which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, `newerSnapshot ==
   * this.compose(this.diff(newerSnapshot))`.
   *
   * **Note:** The word `newer` in the argument name is meant to be suggestive
   * of typical usage of this method, but there is no actual requirement that
   * the argument be strictly newer in any sense, compared to the instance this
   * method is called on.
   *
   * @param {CaretSnapshot} newerSnapshot Snapshot to take the difference from.
   * @returns {CaretChange} Change which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  diff(newerSnapshot) {
    CaretSnapshot.check(newerSnapshot);

    const newerCarets = newerSnapshot._carets;
    const resultOps   = [];

    // Find carets that are new or updated from `this` when going to
    // `newerSnapshot`.

    for (const [sessionId, caretOp] of newerCarets) {
      const already = this._carets.get(sessionId);
      if (already) {
        // The `sessionId` matches the older snapshot. Indicate an update if the
        // values are different.
        if (!already.equals(caretOp)) {
          const diff = already.props.caret.diff(caretOp.props.caret);
          for (const op of diff.ops) {
            resultOps.push(op);
          }
        }
      } else {
        // The `sessionId` isn't in the older snapshot, so this is an addition.
        resultOps.push(caretOp);
      }
    }

    // Find carets removed from `this` when going to `newerSnapshot`.

    for (const sessionId of this._carets.keys()) {
      if (!newerCarets.get(sessionId)) {
        resultOps.push(CaretOp.op_endSession(sessionId));
      }
    }

    // Build the result.
    return new CaretChange(newerSnapshot.revNum, resultOps);
  }

  /**
   * Compares this to another possible-instance, for equality of content.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` iff `other` is also an instance of this class,
   *   and `this` and `other` have equal contents.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof CaretSnapshot)) {
      return false;
    }

    const thisCarets  = this._carets;
    const otherCarets = other._carets;

    if (   (this._revNum    !== other._revNum)
        || (thisCarets.size !== otherCarets.size)) {
      return false;
    }

    for (const [sessionId, thisCaret] of thisCarets) {
      if (!thisCaret.equals(otherCarets.get(sessionId))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets whether or not this instance represents the given session.
   *
   * @param {string} sessionId Session in question.
   * @returns {boolean} `true` if this instance has info for the indicated
   *   session, or `false` if not.
   */
  hasSession(sessionId) {
    TString.nonEmpty(sessionId);
    return this.caretForSession(sessionId) !== null;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this.contents.ops];
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
    const op        = CaretOp.op_beginSession(caret);

    return op.equals(this._carets.get(sessionId))
      ? this
      : this.compose(new CaretChange(this._revNum, [op]));
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
    // This type checks `revNum`, which is why it's not just run when we need
    // to call `compose()`.
    const change = new CaretChange(revNum, CaretDelta.EMPTY);

    return (revNum === this._revNum) ? this : this.compose(change);
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
    return this.withoutSession(caret.sessionId);
  }

  /**
   * Constructs an instance just like this one, except without any reference to
   * the indicated session. If the session is not represented in this instance,
   * this method returns `this`.
   *
   * @param {string} sessionId ID of the session which should not be represented
   *   in the result.
   * @returns {CaretSnapshot} An appropriately-constructed instance.
   */
  withoutSession(sessionId) {
    // This type checks `sessionId`, which is why it's not just run when we need
    // to call `compose()`.
    const op = CaretOp.op_endSession(sessionId);

    return this._carets.has(sessionId)
      ? this.compose(new CaretChange(this._revNum, [op]))
      : this;
  }
}
