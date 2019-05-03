// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import { Caret } from './Caret';
import { CaretChange } from './CaretChange';
import { CaretDelta } from './CaretDelta';
import { CaretId } from './CaretId';
import { CaretOp } from './CaretOp';


/**
 * Snapshot of information about all active carets on a particular document.
 * Instances of this class are always frozen (immutable).
 *
 * When thought of in terms of a map, instances of this class can be taken to
 * be maps from caret ID strings to `Caret` values.
 */
export class CaretSnapshot extends BaseSnapshot {
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
     * {Map<string, CaretOp>} Map of caret ID to an `op_add` which contains a
     * caret with that ID.
     */
    this._carets = new Map();

    // Fill in `_carets`.
    for (const op of this.contents.ops) {
      const opProps = op.props;

      switch (opProps.opName) {
        case CaretOp.CODE_add: {
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
   * Gets an iterator over the `[caretId, caret]` entries that make up the
   * snapshot.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name.
   *
   * @yields {[string, Caret]} Snapshot entries. The keys are the caret IDs,
   *   and the values are the corresponding caret values.
   */
  * entries() {
    for (const op of this.contents.ops) {
      const caret = op.props.caret;
      yield [caret.id, caret];
    }
  }

  /**
   * Gets the {@link Caret} with the given ID. It is an error if this instance
   * has no caret with that ID.
   *
   * **Note:** This differs from the semantics of the `Map` method of the same
   * name in that the not-found case is an error.
   *
   * @param {string} caretId ID of the caret in question.
   * @returns {Caret} Corresponding caret.
   */
  get(caretId) {
    const found = this.getOrNull(caretId);

    if (found) {
      return found;
    }

    throw Errors.badUse(`No such caret: ${caretId}`);
  }

  /**
   * Gets the {@link Caret} with the given ID, if this instance in fact stores
   * such a caret.
   *
   * @param {string} caretId ID of the caret in question.
   * @returns {Caret|null} Corresponding caret, or `null` if there is none.
   */
  getOrNull(caretId) {
    CaretId.check(caretId);

    const found = this._carets.get(caretId);

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

    for (const [caretId, thisCaret] of thisCarets) {
      if (!thisCaret.equals(otherCarets.get(caretId))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets whether or not this instance has a caret with the given ID.
   *
   * **Note:** This has identical semantics to the `Map` method of the same
   * name, except that it will reject `name`s of the wrong type.
   *
   * @param {string} caretId ID of the caret in question.
   * @returns {boolean} `true` if this instance has a caret with the indicated
   *   ID, or `false` if not.
   */
  has(caretId) {
    return this.getOrNull(caretId) !== null;
  }

  /**
   * Returns a randomly-generated ID which is guaranteed not to be used by any
   * caret in this instance.
   *
   * @returns {string} Available caret ID.
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

    const op = CaretOp.op_add(caret);

    return op.equals(this._carets.get(caret.id))
      ? this
      : this.compose(new CaretChange(this.revNum, [op]));
  }

  /**
   * Constructs an instance just like this one, except without any reference to
   * a caret with the indicated ID. If there is no such caret, this method
   * returns `this`.
   *
   * @param {string|Caret} idOrCaret The ID of the caret which should not be
   *   represented in the result, or a {@link Caret} whose ID is used for the
   *   check. (That is, if given a {@link Caret}, only the `id` is consulted; it
   *   doesn't matter if other fields match.
   * @returns {CaretSnapshot} An appropriately-constructed instance.
   */
  withoutCaret(idOrCaret) {
    const caretId = (typeof idOrCaret === 'string')
      ? CaretId.check(idOrCaret)
      : Caret.check(idOrCaret).id;

    if (this._carets.has(caretId)) {
      const op = CaretOp.op_delete(caretId);
      return this.compose(new CaretChange(this.revNum, [op]));
    } else {
      return this;
    }
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

    for (const [caretId, caretOp] of newerCarets) {
      const already = this._carets.get(caretId);
      if (already) {
        // The `caretId` matches the older snapshot. Indicate an update if the
        // values are different.
        if (!already.equals(caretOp)) {
          const diff = already.props.caret.diff(caretOp.props.caret);
          for (const op of diff.ops) {
            resultOps.push(op);
          }
        }
      } else {
        // The `caretId` isn't in the older snapshot, so this is an addition.
        resultOps.push(caretOp);
      }
    }

    // Find carets removed from `this` when going to `newerSnapshot`.

    for (const caretId of this._carets.keys()) {
      if (!newerCarets.get(caretId)) {
        resultOps.push(CaretOp.op_delete(caretId));
      }
    }

    // Build the result.
    return new CaretDelta(resultOps);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {CaretChange} change The change to be validated in the context of
   *   `this`.
   * @throws {Error} Thrown if `change` is not valid to compose with `this`.
   */
  _impl_validateChange() {
    // **TODO:** Implement this!
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return CaretChange;
  }
}
