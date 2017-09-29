// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { TArray, TBoolean } from 'typecheck';
import { CommonBase, DataUtil, Errors, ObjectUtil } from 'util-common';

/**
 * {BodyDelta|null} Empty instance. Initialized in the static getter of the
 * same name.
 */
let EMPTY = null;

/**
 * Always-frozen list of body OT operations. This is a subclass of Quill's
 * `Delta` and mixes in `CommonBase` (the latter for `check()` and `coerce()`
 * functionality). In addition, it contains extra utility functionality beyond
 * what the base `Delta` provides.
 */
export default class BodyDelta extends Delta {
  /** {BodyDelta} Empty instance of this class. */
  static get EMPTY() {
    if (EMPTY === null) {
      EMPTY = new BodyDelta([]);
    }

    return EMPTY;
  }

  /**
   * Constructs an instance.
   *
   * @param {array<object>} ops The transformation operations of this instance.
   *   If not deeply frozen, the actual stored `ops` will be a deep-frozen clone
   *   of the given value.
   */
  constructor(ops) {
    // **TODO:** The contents of `ops` should be validated.
    TArray.check(ops);

    super(DataUtil.deepFreeze(ops));
    Object.freeze(this);
  }

  /**
   * Composes another instance on top of this one, to produce a new instance.
   * This operation works equally whether or not `this` is a document delta.
   *
   * @param {BodyDelta} other The delta to compose.
   * @returns {BodyDelta} Result of composition.
   */
  compose(other) {
    BodyDelta.check(other);

    // Use Quill's implementation.
    const quillThis   = new Delta(this.ops);
    const quillOther  = new Delta(other.ops);
    const quillResult = quillThis.compose(quillOther);

    return new BodyDelta(quillResult.ops);
  }

  /**
   * Computes the difference between this instance and another, where both must
   * be document (from-empty) deltas. The return value is a delta which can be
   * `compose()`d with this instance to produce the delta passed in here as an
   * argument. That is, `newerDelta == this.compose(this.diff(newerDelta))`.
   *
   * **Note:** The parameter name `newer` is meant to be suggestive of the
   * typical use case for this method, but strictly speaking there does not have
   * to be a particular time order between this instance and the argument.
   *
   * @param {BodyDelta} newerDelta Instance to take the difference from.
   * @returns {BodyDelta} Delta which represents the difference between
   *   `newerDelta` and this instance.
   */
  diff(newerDelta) {
    if (!this.isDocument()) {
      throw Errors.bad_use('Called on non-document instance.');
    } else if (!newerDelta.isDocument()) {
      throw Errors.bad_value(newerDelta, BodyDelta, 'isDocument()');
    }

    // Use Quill's implementation.
    const quillThis   = new Delta(this.ops);
    const quillNewer  = new Delta(newerDelta.ops);
    const quillResult = quillThis.diff(quillNewer);

    return new BodyDelta(quillResult.ops);
  }

  /**
   * Compares this to another possible-instance, for equality. To be considered
   * equal, `other` must be an instance of this class with an `ops` which is
   * `DataUtil.equalData()` to this instance's `ops`.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` if `this` and `other` are equal, or `false` if
   *   not.
   */
  equals(other) {
    if (this === other) {
      return true;
    }

    return (other instanceof BodyDelta)
      && DataUtil.equalData(this._ops, other._ops);
  }

  /**
   * Returns `true` iff this instance has the form of a "document," or put
   * another way, iff it is valid to compose with an empty snapshot. In Quill
   * terms, a document is a delta that consists _only_ of `insert` operations.
   *
   * **Note:** Generally speaking, instances for which `isDocument()` is true
   * can _also_ be used as non-document deltas.
   *
   * @returns {boolean} `true` if this instance is a document delta or `false`
   * if not.
   */
  isDocument() {
    for (const op of this.ops) {
      if (!ObjectUtil.hasOwnProperty(op, 'insert')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns `true` iff this instance is empty (that is, it has an empty list
   * of ops).
   *
   * @returns {boolean} `true` if this instance is empty or `false` if not.
   */
  isEmpty() {
    return this.ops.length === 0;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this.ops];
  }

  /**
   * Produces a Quill `Delta` (per se) with the same contents as this instance.
   *
   * @returns {Delta} A Quill `Delta` with the same contents as `this`.
   */
  toQuillForm() {
    return new Delta(this.ops);
  }

  /**
   * Computes the transformation of a delta with respect to this one, such that
   * the result can be composed on top of this instance to produce a sensible
   * combined result. For example, given a document delta and two different
   * change deltas to that specific document, it is reasonable to write code
   * such as:
   *
   * ```javascript
   * document.compose(change1).compose(change1.transform(change2, true))
   * ```
   *
   * **Note:** This operation only makes sense when both `this` and `other` are
   * being treated as non-document deltas.
   *
   * @param {BodyDelta} other Instance to transform.
   * @param {boolean} thisIsFirst "Priority" of the two instances. If `true`
   *   then the operations of `this` are taken to have come first / won the
   *   race. Contrawise, if `false` then the operations of `other` are taken to
   *   have come first.
   * @returns {BodyDelta} Delta which represents the transformation ofbetween
   *   `newerDelta` and this instance.
   */
  transform(other, thisIsFirst) {
    BodyDelta.check(other);
    TBoolean.check(thisIsFirst);

    // Use Quill's implementation.
    const quillThis   = new Delta(this.ops);
    const quillOther  = new Delta(other.ops);
    const quillResult = quillThis.transform(quillOther, thisIsFirst);

    return new BodyDelta(quillResult.ops);
  }
}

// Add `CommonBase` as a mixin, because the main inheritence is the `Delta`
// class.
CommonBase.mixInto(BodyDelta);
