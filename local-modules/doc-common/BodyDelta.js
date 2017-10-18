// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Delta from 'quill-delta';

import { TBoolean, TObject } from 'typecheck';
import { Errors } from 'util-common';

import BaseDelta from './BaseDelta';
import BodyOp from './BodyOp';

/**
 * Always-frozen list of body OT operations. This uses Quill's `Delta` class to
 * implement the "interesting" OT functionality, however this class does _not_
 * inherit from that class, because while the method names have the same names
 * and high-level semantics, the _types_ of the arguments and results are not
 * actually the same. The methods `toQuillForm()` and `fromQuillForm()` can be
 * used to convert back and forth as needed.
 */
export default class BodyDelta extends BaseDelta {
  /**
   * Given a Quill `Delta` instance, returns an instance of this class with the
   * same operations.
   *
   * @param {Delta|array} quillDelta Quill `Delta` instance or array of Quill
   *   delta ops.
   * @returns {BodyDelta} Equivalent instance of this class.
   */
  static fromQuillForm(quillDelta) {
    let ops;

    if (Array.isArray(quillDelta)) {
      ops = quillDelta;
    } else {
      try {
        TObject.check(quillDelta, Delta);
        ops = quillDelta.ops;
      } catch (e) {
        if ((typeof quillDelta === 'object') && (quillDelta.constructor.name === 'Delta')) {
          // The version of `Delta` used by Quill is different than the one we
          // specified in our `package.json`. Even though it will often happen
          // to work if we just let it slide (e.g. by snarfing `ops` out of the
          // object and running with it), we don't want to end up shipping two
          // versions of `Delta` to the client; so, instead of just blithely
          // accepting this possibility, we reject it here and report an error
          // which makes it easy to figure out what happened. Should you find
          // yourself looking at this error, the right thing to do is look at
          // Quill's `package.json` and update the `quill-delta` dependency in
          // this module to what you find there.
          throw Errors.bad_use('Divergent versions of `quill-delta` package.');
        }
        throw e;
      }
    }

    ops = Object.freeze(ops.map(BodyOp.fromQuillForm));
    return new BodyDelta(ops);
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
    const quillThis   = this.toQuillForm();
    const quillOther  = other.toQuillForm();
    const quillResult = quillThis.compose(quillOther);

    return BodyDelta.fromQuillForm(quillResult);
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
    const quillThis   = this.toQuillForm();
    const quillNewer  = newerDelta.toQuillForm();
    const quillResult = quillThis.diff(quillNewer);

    return BodyDelta.fromQuillForm(quillResult);
  }

  /**
   * Produces a Quill `Delta` (per se) with the same contents as this instance.
   *
   * @returns {Delta} A Quill `Delta` with the same contents as `this`.
   */
  toQuillForm() {
    const ops = this.ops.map(op => op.toQuillForm());
    return new Delta(ops);
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
    const quillThis   = this.toQuillForm();
    const quillOther  = other.toQuillForm();
    const quillResult = quillThis.transform(quillOther, thisIsFirst);

    return BodyDelta.fromQuillForm(quillResult);
  }

  /**
   * Main implementation of {@link #isDocument}.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    for (const op of this.ops) {
      if (!op.isInsert()) {
        return false;
      }
    }

    return true;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return BodyOp;
  }
}
