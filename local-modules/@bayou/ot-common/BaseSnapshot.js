// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TFunction } from '@bayou/typecheck';
import { CommonBase, Errors } from '@bayou/util-common';

import { BaseChange } from './BaseChange';
import { RevisionNumber } from './RevisionNumber';

/**
 * Base class for snapshots of (parts of) documents. Every snapshot consists of
 * a revision number and a from-empty delta. Instances of this class are always
 * frozen.
 */
export class BaseSnapshot extends CommonBase {
  /**
   * {BaseSnapshot} Empty instance of this class. It has an empty delta and
   * revision number `0`.
   */
  static get EMPTY() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._EMPTY) {
      this._EMPTY = new this(0, this.deltaClass.EMPTY);
    }

    return this._EMPTY;
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get changeClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._changeClass) {
      // Call the `_impl` and verify the result.
      const clazz = this._impl_changeClass;

      TFunction.checkClass(clazz, BaseChange);
      this._changeClass = clazz;
    }

    return this._changeClass;
  }

  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class.
   */
  static get deltaClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.
    return this.changeClass.deltaClass;
  }

  /**
   * Constructs an instance.
   *
   * **Note:** Subclasses are responsible for freezing the constructed instance.
   *
   * @param {RevisionNumber} revNum Revision number of the document.
   * @param {BaseDelta|array} contents The document contents per se, in the form
   *   of a document delta (that is, a from-empty delta). This must be either an
   *   object of type `deltaClass` as defined by the subclass or an array which
   *   can be passed to the `deltaClass` constructor to produce a valid delta.
   */
  constructor(revNum, contents) {
    super();

    /** {Int} Revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {object} Document contents. */
    this._contents = Array.isArray(contents)
      ? new this.constructor.deltaClass(contents)
      : this.constructor.deltaClass.check(contents);

    // Explicitly check that the `contents` delta has the form of a "document,"
    // as defined by the subclass's `deltaClass`.
    //
    // **TODO:** This might turn out to be a prohibitively slow operation, so it
    // is probably a good idea to evaluate how expensive this is in practice,
    // and figure out a better tactic if need be.
    if (!this._contents.isDocument()) {
      throw Errors.badValue(contents, this.constructor.deltaClass, 'document');
    }
  }

  /** {BaseDelta} The document contents as a from-empty delta. */
  get contents() {
    return this._contents;
  }

  /** {RevisionNumber} The revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * Composes a change on top of this instance, to produce a new instance. If
   * the given `change` has an empty `delta` and has a `revNum` which is the
   * same as this instance, then this method returns `this`. Otherwise, this
   * method returns a new instance.
   *
   * @param {BaseChange} change Change to compose on top of this instance. Must
   *   be an instance of the `changeClass` as defined by the subclass. **Note:**
   *   The `authorId` and `timestamp` of the change are irrelevant to this
   *   operation and so are ignored.
   * @returns {BaseSnapshot} New instance consisting of the composition of this
   *   instance with `change`. Will be a direct instance of the same class as
   *   `this`.
   */
  compose(change) {
    this.constructor.changeClass.check(change);

    const delta = change.delta;

    if (delta.isEmpty()) {
      return this.withRevNum(change.revNum);
    }

    return new this.constructor(change.revNum, this.contents.compose(delta, true));
  }

  /**
   * Composes a sequence of changes on top of this instance, in order, to
   * produce a new instance. If the given array of changes is empty, this method
   * returns `this`. If all of the changes have an empty `delta` and the same
   * `revNum` as this instance (including the case where `changes` is an empty
   * array), this method returns `this`. Otherwise, this method returns a new
   * instance.
   *
   * **Note:** This method is `async` because composing many changes can be
   * CPU-intensive, and as such it can be a bad idea to perform an invocation of
   * this method without having it be able to yield (allow other code to run) in
   * the middle of the operation. The second argument of the method controls
   * the yielding behavior.
   *
   * @param {array<BaseChange>} changes Changes to compose on top of this
   *   instance. Each array element must be an instance of the `changeClass` as
   *   defined by the subclass.
   * @param {Int} [maxChangesPerIteration = 1] The number of changes that are to
   *   be composed without yielding to other computation. (See note above.)
   * @param {function} [yieldFunction = () => {}] Function call and `await` on
   *   the result of, at each iteration. Clients of this method are advised to
   *   insert a short delay in the function's behavior, to help avoid CPU
   *   starvation. The function is passed `start` and `end` arguments with
   *   semantics similar to `Array.slice()`, indicating which elements of
   *   `changes` are _about to be_ processed.
   * @returns {BaseSnapshot} New instance consisting of the composition of
   *   this instance with all of the `changes`. Will be a direct instance of the
   *   same class as `this`.
   */
  async composeAll(changes, maxChangesPerIteration = 1, yieldFunction = () => { /*empty*/ }) {
    TArray.check(changes);

    if (changes.length === 0) {
      return this;
    }

    let contents = this._contents;

    for (let i = 0; i < changes.length; i += maxChangesPerIteration) {
      const startAt = i;
      const endAt   = Math.min(i + maxChangesPerIteration, changes.length);

      const chunk = [];
      for (let j = startAt; j < endAt; j++) {
        const change = this.constructor.changeClass.check(changes[j]);
        chunk.push(change.delta);
      }

      await yieldFunction(startAt, endAt);

      contents = contents.composeAll(chunk, true);
    }

    const revNum = changes[changes.length - 1].revNum;

    if ((revNum === this._revNum) && (contents === this._contents)) {
      return this;
    }

    return new this.constructor(revNum, contents);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    // **Note:** `[0]` on the `delta` argument is because `deconstruct()`
    // returns an _array_ of arguments which can be used to reconstruct an
    // instance, and we know in this case that deltas always deconstruct to a
    // single-element array (because the constructor only accepts one argument).
    return [this._revNum, this._contents.deconstruct()[0]];
  }

  /**
   * Calculates the difference from a given snapshot to this one. The return
   * value is a change which can be composed with this instance to produce the
   * snapshot passed in here as an argument. That is, roughly speaking,
   * `newerSnapshot == this.compose(this.diff(newerSnapshot))`.
   *
   * **Note:** The parameter name `newer` is meant to be suggestive of the
   * typical use case for this method, but strictly speaking there does not have
   * to be a particular time order between this instance and the argument.
   *
   * @param {BaseSnapshot} newerSnapshot Snapshot to take the difference
   *   from. Must be an instance of the same direct class as `this`.
   * @returns {BaseChange} Change which represents the difference between
   *   `newerSnapshot` and this instance. The result is always an instance of
   *   the `deltaClass` as defined by the subclass. The `revNum` of the result
   *   will be the same as `newerSnapshot.revNum`. The `authorId` and
   *   `timestamp` will always be `null`.
   */
  diff(newerSnapshot) {
    this.constructor.check(newerSnapshot);

    // Avoid bothering with a heavyweight diff operation if the deltas are
    // equal.
    const diffDelta = this._contents.equals(newerSnapshot._contents)
      ? this.constructor.deltaClass.EMPTY
      : this._impl_diffAsDelta(newerSnapshot);

    return new this.constructor.changeClass(newerSnapshot.revNum, diffDelta);
  }

  /**
   * Compares this to another possible-instance, for equality. For two instances
   * to be considered equal, they must be instances of the same exact class,
   * their revision numbers must be the same, and their contents must be
   * `.equals()`.
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
    } else if (!(other instanceof BaseSnapshot)) {
      // **Note:** This handles non-objects and `null`s, making the final
      // `return` expression pretty straightforward.
      return false;
    }

    return (this.constructor === other.constructor)
      && (this._revNum === other._revNum)
      && this._contents.equals(other._contents);
  }

  /**
   * Semantic validation for an OT change in the context of this snapshot.
   * Each subclass implements its own version of the semantic validation.
   *
   * @param {BaseChange} change The change to apply.
   * @throws {Error} Thrown if `change` is not valid as a change to
   *   `baseSnapshot`.
   */
  validateChange(change) {
    this.constructor.changeClass.check(change);

    this._impl_validateChange(change);
  }

  /**
   * Returns an instance just like this one except with the content set as
   * given. This will return `this` if `content` is strictly equal (`===`) to
   * `this.content`.
   *
   * @param {object} contents The new contents.
   * @returns {BaseSnapshot} An appropriately-constructed instance. This will be
   *   a direct instance of the same class as `this`.
   */
  withContents(contents) {
    return (contents === this._contents)
      ? this
      : new this.constructor(this._revNum, contents);
  }

  /**
   * Returns an instance just like this one except with the revision number set
   * as given. This will return `this` if `revNum` is the same as what this
   * instance already has.
   *
   * @param {Int} revNum The new revision number.
   * @returns {BaseSnapshot} An appropriately-constructed instance. This will be
   *   a direct instance of the same class as `this`.
   */
  withRevNum(revNum) {
    return (revNum === this._revNum)
      ? this
      : new this.constructor(revNum, this._contents);
  }

  /**
   * Main implementation of {@link #diff}, as defined by the subclass. Takes a
   * snapshot of the same class, and produces a delta (not a change)
   * representing the difference.
   *
   * @abstract
   * @param {BaseSnapshot} newerSnapshot Snapshot to take the difference
   *   from. Guaranteed to be an instance of the same direct class as `this`.
   * @returns {BaseDelta|array} Delta which represents the difference between
   *   `newerSnapshot` and this instance. Must be an instance of the
   *   `deltaClass` as defined by the subclass or an array of operations that
   *   can be used to produce same.
   */
  _impl_diffAsDelta(newerSnapshot) {
    return this._mustOverride(newerSnapshot);
  }

  /**
   * Main implementation of {@link #validateChange}, as defined by the subclass.
   * This method should return without error if `change` is valid to compose
   * with `this`, or throw an error if invalid.
   *
   * @abstract
   * @param {BaseChange} change The change to be validated in the context of
   *   `this`.
   * @throws {Error} Thrown if `change` is not valid to compose with `this`.
   */
  _impl_validateChange(change) {
    this._mustOverride(change);
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class. Subclasses must fill this in.
   *
   * @abstract
   */
  static get _impl_changeClass() {
    return this._mustOverride();
  }
}
