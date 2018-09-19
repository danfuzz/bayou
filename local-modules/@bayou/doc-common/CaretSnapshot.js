// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';
import { TString } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import Caret from './Caret';
import CaretChange from './CaretChange';
import CaretDelta from './CaretDelta';
import CaretId from './CaretId';
import CaretOp from './CaretOp';


/**
 * Snapshot of information about all active carets on a particular document.
 * Instances of this class are always frozen (immutable).
 *
 * When thought of in terms of a map, instances of this class can be taken to
 * be maps from session ID strings to `Caret` values.
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
        case CaretOp.CODE_beginSession: {
          this._carets.set(opProps.caret.id, op);
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
   * {Int} The number of carets defined by this instance.
   *
   * **Note:** This has identical semantics to the `Map` property of the same
   * name.
   */
  get size() {
    return this.contents.ops.length;
  }

  /**
   * Gets an iterator over the `[sessionId, caret]` entries that make up the
   * snapshot.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name.
   *
   * @yields {[string, Caret]} Snapshot entries. The keys are the session IDs,
   *   and the values are the corresponding caret values.
   */
  * entries() {
    for (const op of this.contents.ops) {
      const caret = op.props.caret;
      yield [caret.id, caret];
    }
  }

  /**
   * Gets the caret info for the given session. It is an error if this instance
   * has no caret for the indicated session.
   *
   * **Note:** This differs from the semantics of the `Map` method of the same
   * name in that the not-found case is an error.
   *
   * @param {string} sessionId Session in question.
   * @returns {Caret} Corresponding caret.
   */
  get(sessionId) {
    const found = this.getOrNull(sessionId);

    if (found) {
      return found;
    }

    throw Errors.badUse(`No such session: ${sessionId}`);
  }

  /**
   * Gets the caret info for the given session, if any.
   *
   * @param {string} sessionId Session in question.
   * @returns {Caret|null} Corresponding caret, or `null` if there is none.
   */
  getOrNull(sessionId) {
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
   * Gets whether or not this instance has a caret for the given session.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name, except that it will reject `name`s of the wrong type.
   *
   * @param {string} sessionId Session in question.
   * @returns {boolean} `true` if this instance has a caret for the indicated
   *   session, or `false` if not.
   */
  has(sessionId) {
    return this.getOrNull(sessionId) !== null;
  }

  /**
   * Returns a randomly-generated ID which is guaranteed not to be used by any
   * caret in this instance.
   *
   * @returns {string} Available session ID.
   */
  randomUnusedId() {
    // Loop in case we get _very_ unlucky.
    for (;;) {
      const result = CaretId.randomInstance();
      if (!this.has(result)) {
        return result;
      }
    }
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

    const id = caret.id;
    const op = CaretOp.op_beginSession(caret);

    return op.equals(this._carets.get(id))
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
    return this.withoutSession(caret.id);
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

  // TODO: implement caret snapshot specific validation
  _impl_validateChange() {
    return true;
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return CaretChange;
  }
}
