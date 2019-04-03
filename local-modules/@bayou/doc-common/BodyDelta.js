// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Text } from '@bayou/config-common';
import { BaseDelta } from '@bayou/ot-common';
import { Logger } from '@bayou/see-all';
import { TBoolean, TObject } from '@bayou/typecheck';
import { Errors } from '@bayou/util-common';

import BodyOp from './BodyOp';

/**
 * {Logger} Logger for this module. **Note:** Just used for some temporary
 * debugging stuff.
 */
const log = new Logger('body-delta');

/**
 * Always-frozen list of body OT operations. This uses Quill's `Delta` class to
 * implement the "interesting" OT functionality, however this class does _not_
 * inherit from that class, because while the method names have the same names
 * and high-level semantics, the _types_ of the arguments and results are not
 * actually the same. The methods `toQuillForm()` and `fromQuillForm()` can be
 * used to convert back and forth as needed.
 *
 * As a document delta, instances of this class must either be totally empty (no
 * ops) or consist only of text insertion and embed ops with the final op always
 * a text insertion op with text payload that ends with a newline.
 *
 * **Note:** It is _arguably_ the case that a completely empty delta shouldn't
 * be considered a document, because the basic constraint is "ends with
 * newline." However, making this a requirement is problematic in the current
 * implementation, specifically because there is a single `EMPTY` instance per
 * concrete class which is set up by the base class to always be a no-ops
 * instance, and this `EMPTY` instance is in turn used to make the contents for
 * a no-ops snapshot.
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
      ops = BodyDelta._opsOfQuillDelta(quillDelta);
    }

    ops = Object.freeze(ops.map(BodyOp.fromQuillForm));
    return new BodyDelta(ops);
  }

  /**
   * Computes the difference between this instance and another, where both must
   * be document (from-empty) deltas. The return value is a delta which can be
   * `compose()`d with this instance to produce the delta passed in here as an
   * argument. That is, `newerDelta == this.compose(this.diff(newerDelta),
   * true)`.
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
      throw Errors.badUse('Called on non-document instance.');
    } else if (!newerDelta.isDocument()) {
      throw Errors.badValue(newerDelta, BodyDelta, 'isDocument()');
    }

    // Use Quill's implementation.
    const quillThis   = this.toQuillForm();
    const quillNewer  = newerDelta.toQuillForm();
    const quillResult = quillThis.diff(quillNewer);

    return BodyDelta.fromQuillForm(quillResult);
  }

  /**
   * Indicates whether this instance is ends with a newline character as a text
   * insertion, _or_ if it is a totally empty instance (no ops).
   *
   * **Note:** A document delta is supposed to end with a newline, but this
   * has not been enforced before. As things stand, it is not possible to
   * consider completely empty (no ops) instances as being non-document,
   * because the value {@link #EMPTY} is set up by the superclass and is always
   * necessarily a no-op instance, and that in turn becomes the basis for
   * {@link BodySnapshot#EMPTY}. However, so long as there is at least one op,
   * it _may_ be reasonable to treat an instance of this class as non-document
   * if the last op isn't a text insertion that ends with a newline. Rather than
   * just implement that check in {@link #_impl_isDocument} and return `false`
   * if it fails, we provide this method for use at call sites where a document
   * is expected, so that those sites can log the would-be failure. Based on log
   * analysis, we can get a sense of the scope of the problem, and based on that
   * data decide whether or not to tighten the actual constraint in
   * {@link #_impl_isDocument}.
   *
   * @returns {boolean} `true` if this instance meets the defined constraints,
   *   or `false` if not.
   */
  endsWithNewlineOrIsEmpty() {
    const ops = this.ops;

    if (ops.length === 0) {
      return true;
    }

    const lastOp = ops[ops.length - 1];
    const props  = lastOp.props;

    return (props.opName === BodyOp.CODE_text)
      && props.text.endsWith('\n');
  }

  /**
   * Produces a Quill `Delta` (per se) with the same contents as this instance.
   *
   * @returns {Delta} A Quill `Delta` with the same contents as `this`.
   */
  toQuillForm() {
    const ops = this.ops.map(op => op.toQuillForm());
    return new Text.Delta(ops);
  }

  /**
   * Computes the transformation of a delta with respect to this one, such that
   * the result can be composed on top of this instance to produce a sensible
   * combined result. For example, given a document delta and two different
   * change deltas to that specific document, it is reasonable to write code
   * such as:
   *
   * ```javascript
   * document
   *   .compose(change1, false)
   *   .compose(change1.transform(change2, true), false)
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
   * Main implementation of {@link #compose}.
   *
   * @param {BodyDelta} other Delta to compose with this instance.
   * @param {boolean} wantDocument Whether the result of the operation should be
   *   a document delta.
   * @returns {BodyDelta} Composed result.
   */
  _impl_compose(other, wantDocument) {
    // Use Quill's implementation.
    const quillThis   = this.toQuillForm();
    const quillOther  = other.toQuillForm();
    const quillResult = quillThis.compose(quillOther);
    const result      = BodyDelta.fromQuillForm(quillResult);

    // **Note:** `quill-delta` doesn't alter its behavior based on whether the
    // result should be a document or not, and it is possible to have a valid
    // (from `quill-delta`'s perspective) case of a valid document `this` to be
    // composed with a valid change `other`, returning a _non-document_ delta
    // result. Trivial example (in pseudocode):
    //
    //   this                = [insert('xyz')]
    //   other               = [retain(4)]
    //   this.compose(other) = [insert('xyz'), retain(1)]
    //
    // That last line is a valid `quill-delta` composition result, but in the
    // context of `wantDocument === true` it is invalid, because document deltas
    // are not allowed to have any `retain` operations (because there is by
    // definition nothing to retain).
    //
    // The following check _just_ catches these sorts of problems, providing a
    // reasonably apt error message, so as to avoid confusing any of the higher
    // layers.
    //
    // **TODO:** This rejects document composition results that fail the
    // stricter test defined by `endsWithNewlineOrIsEmpty()`. See discussion in
    // that method about including its tests in `_impl_isDocument()` which would
    // remove the need for explicitly performing this test here.

    if (wantDocument && !(result.isDocument() && result.endsWithNewlineOrIsEmpty())) {
      // **TODO:** Remove this logging once we track down why we're seeing this
      // error.
      log.event.badComposeOrig(this, other, result);
      log.event.badComposeQuill(quillThis.ops, quillOther.ops, quillResult.ops);

      throw Errors.badUse('Inappropriate `other` for composition given `wantDocument === true`.');
    }

    return result;
  }

  /**
   * Main implementation of {@link #isDocument}.
   *
   * @returns {boolean} `true` if this instance can be used as a document or
   *   `false` if not.
   */
  _impl_isDocument() {
    // **TODO:** See note in `endsWithNewlineOrIsEmpty()` about possible changes
    // to this method.

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

  /**
   * Checks that the argument is a Quill delta, and if so returns the `ops`
   * array inside it. Throws an error if not.
   *
   * @param {Delta} quillDelta Quill delta instance.
   * @returns {array} Array of Quill operations that `delta` contains.
   */
  static _opsOfQuillDelta(quillDelta) {
    try {
      TObject.check(quillDelta, Text.Delta);
    } catch (e) {
      if ((typeof quillDelta === 'object') && (quillDelta.constructor.name === 'Delta')) {
        // The version of `Delta` used by Quill is different than the one which
        // is specified in the configuration hook
        // {@link @bayou/config-common/Text}. Even though it will often happen
        // to work if we just let it slide (e.g. by snarfing `ops` out of the
        // object and running with it), we don't want to end up shipping two
        // versions of `Delta` to the client; so, instead of just blithely
        // accepting this possibility, we reject it here and report an error
        // which makes it easy to figure out what happened. Should you find
        // yourself looking at this error, the likely right thing to do is
        // look at the lines logged just before the error was thrown, and change
        // either how `Text` is configured to match the incoming `Delta` version
        // _or_ change where the incoming `Delta` version is used to match what
        // got configured for `Text`. Of particular note, if you are using a
        // version of `Quill` in distribution form, it bundles within itself a
        // version of `Delta`, and you will want to make sure that `Text` uses
        // `Quill.import('delta')` to get it hooked up.

        // This is an attempt to get a stack trace each from both "our" `Delta`
        // and the incoming `Delta`, as a possible breadcrumb for folks running
        // into this problem.
        log.error('Divergent versions of `quill-delta` package.');
        BodyDelta._logWhichDelta('ours', Text.Delta);
        BodyDelta._logWhichDelta('incoming', quillDelta.constructor);

        throw Errors.badUse('Divergent versions of `quill-delta` package.');
      }

      throw e;
    }

    return quillDelta.ops;
  }

  /**
   * Helper used when making the "divergent" complaint, which aims to log an
   * error pointing at the source of one of the versions of `Delta`.
   *
   * @param {string} label Short label indicating which version this is.
   * @param {class} Delta A version of the `Delta` class.
   */
  static _logWhichDelta(label, Delta) {
    const delta = new Delta([{ insert: 'x' }]);

    let trace;
    try {
      delta.forEach(() => { throw new Error('x'); });
    } catch (e) {
      trace = e.stack;
    }

    for (const line of trace.split('\n')) {
      const match = line.match(/at Delta[^(]+\(([^:)]+)[:)]/);
      if (match) {
        log.info(`${label}: ${match[1]}`);
        return;
      }
    }

    log.error(`Could not determine \`Delta\` version "${label}" from stack trace!`, trace);
  }
}
