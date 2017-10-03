// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString } from 'typecheck';
import { Errors } from 'util-common';

import BaseSnapshot from './BaseSnapshot';
import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretOp from './CaretOp';


/**
 * Snapshot of information about all active sessions on a particular document.
 * Instances of this class are always frozen (immutable).
 */
export default class CaretSnapshot extends BaseSnapshot {
  /**
   * Constructs an instance.
   *
   * @param {Int} revNum Revision number of the caret information.
   * @param {CaretDelta|array<CaretOp>} contents A from-empty delta (or array of
   *   ops which can be used to construct same), representing all the carets to
   *   include in the instance.
   */
  constructor(revNum, contents) {
    super(revNum, contents);

    /**
     * {Map<string, CaretOp>} Map of session ID to an `op_beginSession` which
     * defines the caret for that session.
     */
    this._carets = new Map();

    // Fill in `_carets`.
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.BEGIN_SESSION: {
          this._carets.set(opProps.caret.sessionId, op);
          break;
        }

        default: {
          // Should have been prevented by the `isDocument()` check.
          throw Errors.wtf('Weird op');
        }
      }
    }

    Object.freeze(this._carets);
    Object.freeze(this);
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

    if (   (this.revNum     !== other.revNum)
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
      : this.compose(new CaretChange(this.revNum, [op]));
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
      ? this.compose(new CaretChange(this.revNum, [op]))
      : this;
  }

  /**
   * Main implementation of {@link #compose}. Takes a delta (not a change
   * instance), and produces a document delta (not a snapshot).
   *
   * **Note:** It is an error if `delta` contains an `op_setField` to a caret
   * that either does not exist in `this` or was not first introduced with an
   * `op_beginSession`.
   *
   * @param {CaretDelta} delta Difference to compose with this instance's
   *   contents.
   * @returns {CaretDelta} Delta which represents the composed document
   *   contents.
   */
  _impl_composeWithDelta(delta) {
    const newCarets = new Map(this._carets);

    for (const op of delta.ops) {
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

    return new CaretDelta([...newCarets.values()]);
  }

  /**
   * Main implementation of {@link #diff}, which produces a delta (not a
   * change).
   *
   * @param {CaretSnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {CaretDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  _impl_diffAsDelta(newerSnapshot) {
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
    return new CaretDelta(resultOps);
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return CaretChange;
  }
}
