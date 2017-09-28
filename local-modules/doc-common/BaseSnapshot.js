// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';
import { CommonBase, Errors } from 'util-common';

import BaseChange from './BaseChange';
import RevisionNumber from './RevisionNumber';

/**
 * Base class for snapshots of (parts of) documents. Every snapshot consists of
 * a revision number and a from-empty delta. Instances of this class are always
 * frozen.
 */
export default class BaseSnapshot extends CommonBase {
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

      TObject.check(clazz.prototype, BaseChange);
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
   * @param {object|array} contents The document contents per se, in the form of
   *   a document delta (that is, a from-empty delta). This must be either an
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
      throw Errors.bad_value(contents, this.constructor.deltaClass, 'document');
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
    }

    return (this.constructor === other.constructor)
      && (this._revNum === other._revNum)
      && this._contents.equals(other._contents);
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    return [this._revNum, this._contents];
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
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class. Subclasses must be fill this in.
   *
   * @abstract
   */
  static get _impl_changeClass() {
    return this._mustOverride();
  }
}
