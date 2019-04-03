// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';
import { Errors } from '@bayou/util-common';

import BodyChange from './BodyChange';

/**
 * Snapshot of main document body contents.
 */
export default class BodySnapshot extends BaseSnapshot {
  /**
   * Constructs an instance.
   *
   * @param {RevisionNumber} revNum Revision number of the document.
   * @param {object|array} contents The document contents per se, in the form of
   *   a document delta (that is, a from-empty delta). This must be either a
   *   `BodyDelta` or an array which can be passed to the `BodyDelta`
   *   constructor to produce a valid delta.
   */
  constructor(revNum, contents) {
    super(revNum, contents);

    Object.freeze(this);
  }

  /**
   * {Int} The length of this document, where the count is made
   * up of text and embeds. An embed has a length of 1.
   */
  get length() {
    const bodyContentOps = this.contents.ops;

    // Assume all contents are `text` or `embed`
    const length = bodyContentOps.reduce((sum, op) => sum + op.getLength(), 0);

    return length;
  }

  /**
   * Main implementation of {@link #diff}, which produces a delta (not a
   * change).
   *
   * @param {BodySnapshot} newerSnapshot Snapshot to take the difference
   *   from.
   * @returns {BodyDelta} Delta which represents the difference between
   *   `newerSnapshot` and this instance.
   */
  _impl_diffAsDelta(newerSnapshot) {
    const oldContents = this.contents;
    const newContents = newerSnapshot.contents;

    return oldContents.diff(newContents);
  }

  /**
   * Implementation as required by the superclass.
   *
   * @param {BodyChange} change The change to be validated in the context of
   *   `this`.
   * @throws {Error} Thrown if `change` is not valid to compose with `this`.
   */
  _impl_validateChange(change) {
    const ops = change.delta.ops;

    for (const op of ops) {
      const opProps = op.props;
      const { opName } = opProps;

      // TODO: validate `delete` in a similar way
      switch (opName) {
        case 'retain': {
          this._validateRetainOp(op, this.length);
          break;
        }
        default: {
          break;
        }
      }
    }
  }

  /**
   * Performs semantic validation on a retain OP.
   * Checks to make sure that the given retain OP's count
   * does not exceed the document body length
   * @param {BodyOp} retainOp A retain Op.
   * @param {Int} bodyLength The maximum length that can be retained.
   * @throws {Error} A validation error if any semantic validation fails
   *   on given `retain` op.
   */
  _validateRetainOp(retainOp, bodyLength) {
    const { count } = retainOp.props;

    if (count > bodyLength) {
      throw Errors.badData(`Attempting to retain ${count} when document length is ${bodyLength}`);
    }
  }

  /**
   * {class} Class (constructor function) of change objects to be used with
   * instances of this class.
   */
  static get _impl_changeClass() {
    return BodyChange;
  }
}
