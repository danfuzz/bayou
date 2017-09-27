// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TIterable, TString } from 'typecheck';
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
    RevisionNumber.check(revNum);

    if (Array.isArray(delta)) {
      delta = new CaretDelta(delta);
    } else if (delta[Symbol.iterator]) {
      // FIXME: Remove this clause after conversion of call sites.
      TIterable.check(delta);
      const ops = [];
      for (const caret of delta) {
        ops.push(CaretOp.op_beginSession(caret));
      }
      delta = new CaretDelta(ops);
    }

    super();

    /** {Int} The caret information revision number. */
    this._revNum = revNum;

    /** {Map<string, Caret>} Map of session ID to corresponding caret. */
    this._carets = new Map();

    // Fill in `_carets`.
    for (const op of delta.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.BEGIN_SESSION: {
          const caret     = opProps.caret;
          const sessionId = caret.sessionId;

          if (this._carets.has(sessionId)) {
            throw Errors.bad_use(`Duplicate caret: ${sessionId}`);
          }

          this._carets.set(sessionId, caret);
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
    return this._carets.get(sessionId) || null;
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

    const newCarets = new Map(this._carets.entries());

    for (const op of change.delta.ops) {
      const props = op.props;

      switch (props.opName) {
        case CaretOp.BEGIN_SESSION: {
          const caret = props.caret;
          newCarets.set(caret.sessionId, caret);
          break;
        }

        case CaretOp.SET_FIELD: {
          const sessionId = props.sessionId;
          const caret     = newCarets.get(sessionId);

          if (!caret) {
            throw Errors.bad_use(`Invalid delta; update to nonexistent caret: ${sessionId}`);
          }

          newCarets.set(sessionId, caret.compose(new CaretDelta([op])));
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

    return new CaretSnapshot(change.revNum, newCarets.values());
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
    const caretOps    = [];

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
    return new CaretChange(newerSnapshot.revNum, caretOps);
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
      const otherCaret = otherCarets.get(sessionId);
      if (!(otherCaret && otherCaret.equals(thisCaret))) {
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
    TString.nonEmpty(sessionId);
    const carets = this._carets;

    if (!carets.has(sessionId)) {
      return this;
    }

    const newCarets = new Map(carets);
    newCarets.delete(sessionId);

    return new CaretSnapshot(this._revNum, newCarets.values());
  }
}
