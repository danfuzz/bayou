// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TBoolean, TFunction } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import { BaseOp } from './BaseOp';

/**
 * Base class for document deltas. These are ordered lists of operations which
 * indicate how to take one document state and transform it into a new document
 * state. Subclasses of this class specialize on particular aspects of a
 * (larger) document.
 *
 * Instances of (subclasses of) this class are used as the main payload data for
 * the various "change" and "snapshot" classes.
 *
 * Instances of this class are immutable.
 */
export class BaseDelta extends CommonBase {
  /**
   * {BaseDelta} Empty instance of this class, that is, an instance whose `ops`
   * is an empty array (`[]`). This is a direct instance of whatever class this
   * is accessed on (and not just a `BaseDelta` per se).
   */
  static get EMPTY() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!(this._EMPTY instanceof this)) {
      this._EMPTY = new this([]);
    }

    return this._EMPTY;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get opClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._opClass) {
      // Call the `_impl` and verify the result.
      const clazz = this._impl_opClass;

      TFunction.checkClass(clazz, BaseOp);
      this._opClass = clazz;
    }

    return this._opClass;
  }

  /**
   * Constructs an instance.
   *
   * @param {array<BaseOp>|array<array<*>>} ops Array of operations _or_ array
   *   of arrays of operation construction arguments. In the former case, each
   *   operation must be an instance of {@link #opClass} as defined by the
   *   subclass, and if not passed as a frozen array, the constructed instance
   *   will instead store a frozen clone of this value. In the latter case, each
   *   element of the array must be valid as arguments to the {@link #opClass}
   *   constructor; the resulting instance of this class stores the array of
   *   so-constructed operations.
   */
  constructor(ops) {
    super();

    const opClass = this.constructor.opClass;
    TArray.check(ops);

    // Use the first element of `ops` to figure out how to validate the
    // contents. Treat a zero-length array as an array of ops (not of
    // arguments).
    if ((ops.length !== 0) && (Array.isArray(ops[0]))) {
      // Array of op constructor argument arrays.

      TArray.check(ops, x => TArray.check(x));
      const constructedOps = [];

      for (const args of ops) {
        constructedOps.push(new opClass(...args));
      }

      ops = Object.freeze(constructedOps);
    } else {
      // Array of ops (or empty array).

      TArray.check(ops, op => opClass.check(op));

      if (!Object.isFrozen(ops)) {
        ops = Object.freeze(ops.slice());
      }
    }

    /** {array<object>} Array of operations. */
    this._ops = ops;

    Object.freeze(this);
  }

  /**
   * {array<object>} Array of operations to be applied. This is guaranteed to
   * be a frozen (immutable) value.
   */
  get ops() {
    return this._ops;
  }

  /**
   * {Int} The "rough size" of this instance, in terms of storage requirements
   * in working memory or stable storage, as positive integer of an ill-defined
   * unit. This is _not_ a guaranteed size (such as of bytes); it is merely
   * meant for apples-to-apples comparisons amongst instances of the same class.
   *
   * More specifically, on this class, the rough size is the sum of the rough
   * sizes of all ops, plus an arbitrary small constant factor per op.
   */
  get roughSize() {
    const ops   = this._ops;
    let   total = ops.length * 8;

    for (const op of ops) {
      total += op.roughSize;
    }

    return total;
  }

  /**
   * Composes another instance on top of this one, to produce a new instance.
   * This operation works equally whether or not `this` is a document delta.
   * If `other` is an empty delta, this method still typically returns a new
   * instance, though subclasses can choose to return `this` if circumstances
   * warrant it).
   *
   * @param {BaseDelta} other The delta to compose. Must be an instance of the
   *   same concrete class as `this`.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta. _Some_ subclasses operate differently when asked to
   *   produce a document vs. not, and this parameter controls that (potential)
   *   behavior. When `true`, `this` must be passed as a document delta.
   * @returns {BaseDelta} Result of composition. Is always an instance of the
   *   same concrete class as `this`.
   */
  compose(other, wantDocument) {
    return this.composeAll([other], wantDocument);
  }

  /**
   * Composes a sequence of deltas on top of this instance, in order, to
   * produce a new instance. This operation works equally whether or not `this`
   * is a document delta. If the given array is empty, this method returns
   * `this`. Otherwise, this method typically returns a new instance (though
   * subclasses can choose to return `this` if circumstances warrant it).
   *
   * **Note:** This method can potentially be CPU-intensive, especially if the
   * `deltas` array has many elements and/or has many ops inside the elements
   * (in aggregate). As such, it is recommended practice to split known (or
   * reasonably expected) intense compositions into separate invocations across
   * multiple ticks. One layer up in this module, the method
   * {@link BaseSnapshot#composeAll} is in fact an `async` method which knows
   * how to split things up appropriately. It may be a good idea to call that
   * instead of calling this method more directly.
   *
   * @param {array<BaseDelta>} deltas Instances to compose on top of this
   *   instance. Each array element must be an instance of the `deltaClass` as
   *   defined by the subclass.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta. _Some_ subclasses operate differently when asked to
   *   produce a document vs. not, and this parameter controls that (potential)
   *   behavior. When `true`, `this` must be passed as a document delta.
   * @returns {BaseDelta} New instance consisting of the composition of
   *   this instance with all of the `deltas`. Will be a direct instance of the
   *   same class as `this`.
   */
  composeAll(deltas, wantDocument) {
    TArray.check(deltas, d => this.constructor.check(d));
    TBoolean.check(wantDocument);

    if (wantDocument && !this.isDocument()) {
      throw Errors.badUse('`wantDocument === true` on non-document instance.');
    }

    if (deltas.length === 0) {
      return this;
    }

    const result = (deltas.length === 1)
      ? this._impl_compose(deltas[0], wantDocument)
      : this._impl_composeAll(deltas, wantDocument);

    this._checkResult(result, wantDocument);
    return result;
  }

  /**
   * "Deconstructs" this instance, returning an array of arguments which is
   * suitable for passing to the constructor of this class.
   *
   * More specifically in this case, this returns a top-level single-element
   * array (because the constructor of this class expects a single argument
   * which is an array), with the sole element being a compact array-of-arrays
   * form. Each element of the returned array is a list of arguments which can
   * be passed to the {@link #opClass} constructor to recreate the corresponding
   * op.
   *
   * The point of this choice of return form is to allow for more compact
   * representation of instances of this class (and of instances of classes that
   * use this class) in codec-encoded form. In particular, the name of the
   * `opClass` gets to be implied instead of redundantly encoded.
   *
   * @returns {array<array<*>>} Array of array of operation-construction
   *   arguments.
   */
  deconstruct() {
    const ops = this._ops.map(op => op.deconstruct());

    return [ops];
  }

  /**
   * Compares this to another possible-instance, for equality. To be considered
   * equal:
   *
   * * `other` must be an instance of the same direct class as `this`.
   * * The two instance's `ops` arrays must be the same length.
   * * Corresponding `ops` elements must be `.equals()`.
   *
   * Subclasses may override this method if this behavior isn't right for them.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` if `this` and `other` are equal, or `false` if
   *   not.
   */
  equals(other) {
    if (this === other) {
      return true;
    } else if (!(other instanceof BaseDelta)) {
      // **Note:** This handles non-objects and `null`s, making the next
      // pair of checks (below) more straightforward.
      return false;
    }

    const thisOps  = this._ops;
    const otherOps = other._ops;

    if (   (this.constructor !== other.constructor)
        || (thisOps.length !== otherOps.length)) {
      return false;
    }

    for (let i = 0; i < thisOps.length; i++) {
      if (!thisOps[i].equals(otherOps[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns `true` iff this instance has the form of a "document," or put
   * another way, iff it is valid to compose with an instance which represents
   * an empty snapshot. The details of what makes an instance a document vary
   * from subclass to subclass.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  isDocument() {
    // **TODO:** Consider caching the results of this call, if it turns out to
    // be common for it to be called many times on the same object.
    const result = this._impl_isDocument();

    return TBoolean.check(result);
  }

  /**
   * Returns `true` iff this instance is empty. An empty instance is defined as
   * one whose `ops` array has no elements.
   *
   * @returns {boolean} `true` if this instance is empty, or `false` if not.
   */
  isEmpty() {
    return this._ops.length === 0;
  }

  /**
   * Main implementation of {@link #compose} and {@link #composeAll} (the latter
   * if {@link #_impl_composeAll} is not specialized). Subclasses must fill this
   * in.
   *
   * @abstract
   * @param {BaseDelta} other Delta to compose with this instance. Guaranteed
   *   to be an instance of the same concrete class as `this`.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta. If this is passed as `true`, this class guarantees that
   *   `other` is also a document delta.
   * @returns {BaseDelta} Composed result. Must be an instance of the same
   *   concrete class as `this`.
   */
  _impl_compose(other, wantDocument) {
    return this._mustOverride(other, wantDocument);
  }

  /**
   * Main implementation of {@link #composeAll}. Subclasses do not have to
   * override this; if not, the default implementation calls through to
   * {@link #_impl_compose} on individual deltas, producing a combined result.
   * must fill this in. If `wantDocument` is passed as `true`, `this` is
   * guaranteed to be a document delta.
   *
   * @param {array<BaseDelta>} deltas Instances to compose on top of this
   *   instance. This is guaranteed to be an array consisting of instances of
   *   the same concrete class as `this`.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta. If this is passed as `true`, this class guarantees that
   *   `other` is also a document delta.
   * @returns {BaseDelta} Composed result. Must be an instance of the same
   *   concrete class as `this`.
   */
  _impl_composeAll(deltas, wantDocument) {
    let result = this;

    for (const d of deltas) {
      if (result !== this) {
        // No need to check the incoming `this`, as the caller (in this class)
        // guarantees validity. Somewhat similarly, we do the check here at the
        // top of the loop instead of after the re-assignment of `result` below,
        // because the caller will always check the final result, and so a
        // post-assignment check here would _also_ be redundant.
        this._checkResult(result, wantDocument);
      }

      result = result._impl_compose(d, wantDocument);
    }

    return result;
  }

  /**
   * Main implementation of {@link #isDocument}. Subclasses must fill this in.
   *
   * @abstract
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    return this._mustOverride();
  }

  /**
   * Helper for validation of subclass behavior, which checks that the given
   * value is an instance of the class, and optionally that it is a document
   * delta. Throws an error if the check(s) fail.
   *
   * @param {*} result (Alleged) instance.
   * @param {boolean} wantDocument Whether `result` must be a document delta.
   */
  _checkResult(result, wantDocument) {
    this.constructor.check(result);

    if (wantDocument && !result.isDocument()) {
      // This indicates a bug in the subclass.
      throw Errors.wtf('Non-document return value when passed `true` for `wantDocument`.');
    }
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   *
   * @abstract
   */
  static get _impl_opClass() {
    return this._mustOverride();
  }
}
