// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction, TObject } from 'typecheck';
import { CommonBase } from 'util-common';

import AuthorId from './AuthorId';
import RevisionNumber from './RevisionNumber';
import Timestamp from './Timestamp';

/**
 * Base class for representation of a change to document content. A change
 * consists of four parts:
 *
 * * the revision number (of the document or document part) produced by the
 *   change when applied in context.
 *
 * * a delta (instructions for change), which describes the details of the
 *   change from the document's contextually-defined previous state. The context
 *   is sometimes (but not always) the immediately-previous revision of the
 *   document. The other typical context is an _expected_ document based on
 *   an attempt to apply an update.
 *
 * * an optional timestamp, which specifies the moment in time when the change
 *   was created (e.g. by an end user). This is only present if there is a
 *   single specific moment in time at which the change was made. As a
 *   counter-example, instances of this class which are created by composing
 *   multiple other changes will not typically have a timestamp.
 *
 * * an optional ID of the author, which identifies the entity who created the
 *   change. As with the timestamp, this is only present if there is a single
 *   unique author of a change. As a counter-example, some changes are created
 *   "spontaneously" by the system (e.g. the empty first change to a document)
 *   and as such have no author.
 *
 * Instances of (subclasses of) this class are both consumed and produced by the
 * various "snapshot" classes.
 *
 * Instances of this class are immutable.
 */
export default class BaseChange extends CommonBase {
  /**
   * {BaseChange} Representation of the empty (and authorless and timeless)
   * first change to a document.
   */
  static get FIRST() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._FIRST) {
      this._FIRST = new this(0, this.deltaClass.EMPTY);
    }

    return this._FIRST;
  }

  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class.
   */
  static get deltaClass() {
    // **Note:** `this` in the context of a static method is the class, not an
    // instance.

    if (!this._deltaClass) {
      // Call the `_impl` and verify the result.
      const clazz = TFunction.checkClass(this._impl_deltaClass);

      TObject.check(clazz.EMPTY, clazz);
      TFunction.checkCallable(clazz.check);
      this._deltaClass = clazz;
    }

    return this._deltaClass;
  }

  /**
   * Constructs an instance.
   *
   * @param {Int} revNum The revision number of the document produced by this
   *   instance (when composed as contextually appropriate). If this instance
   *   represents the first change to a document, then this value will be `0`.
   * @param {object|array} delta The document change per se, compared to the
   *   implied base revision. This must be either an object of type `deltaClass`
   *   as defined by the subclass or an array which can be passed to the
   *   `deltaClass` constructor to produce a valid delta.
   * @param {Timestamp|null} [timestamp = null] The time of the change, or
   *   `null` if the change doesn't have an associated moment of time.
   * @param {string|null} [authorId = null] Stable identifier string
   *   representing the author of the change. Allowed to be `null` if the change
   *   is authorless.
   */
  constructor(revNum, delta, timestamp = null, authorId = null) {
    super();

    /** {Int} The produced revision number. */
    this._revNum = RevisionNumber.check(revNum);

    /** {object} The main content delta. */
    this._delta = Array.isArray(delta)
      ? new this.constructor.deltaClass(delta)
      : this.constructor.deltaClass.check(delta);

    /** {Timestamp|null} The time of the change. */
    this._timestamp = Timestamp.orNull(timestamp);

    /**
     * {string|null} Author ID string, or `null` if the change is
     * authorless.
     */
    this._authorId = AuthorId.orNull(authorId);

    Object.freeze(this);
  }

  /**
   * {string|null} The author ID string, or `null` if the change is authorless
   * (or if the concept of "author" is meaningless in the larger context of this
   * instance).
   */
  get authorId() {
    return this._authorId;
  }

  /**
   * {object} The main delta content. This is an instance of `deltaClass` as
   * defined by the subclass.
   */
  get delta() {
    return this._delta;
  }

  /** {Int} The produced revision number. */
  get revNum() {
    return this._revNum;
  }

  /**
   * {Timestamp|null} The time of the change, or `null` if the change has no
   * specific associated moment in time.
   */
  get timestamp() {
    return this._timestamp;
  }

  /**
   * Converts this instance for API transmission.
   *
   * @returns {array} Reconstruction arguments.
   */
  toApi() {
    const result = [this._revNum, this._delta, this._timestamp, this._authorId];

    // Trim off one or two trailing `null`s, if possible.
    for (let i = 3; i >= 2; i--) {
      if (result[i] !== null) {
        break;
      }
      result.pop();
    }

    return result;
  }

  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class. Subclasses must be fill this in.
   *
   * @abstract
   */
  static get _impl_deltaClass() {
    return this._mustOverride();
  }
}
