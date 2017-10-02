// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from 'util-common';

import { BaseDelta } from 'doc-common';

/**
 * Mock operation class.
 */
class MockOp extends CommonBase {
  constructor(name) {
    super();
    this.name = name;
  }

  equals(other) {
    return (other instanceof MockOp) && (this.name === other.name);
  }
}

/**
 * Mock "delta" class for testing.
 */
export default class MockDelta extends BaseDelta {
  /** {array<object>} Would-be ops array that contains an invalid element. */
  static get INVALID_OPS() {
    return ['not_an_op'];
  }

  /**
   * {array<object>} Ops array that will indicate that the delta is not a
   * document.
   */
  static get NOT_DOCUMENT_OPS() {
    return [new MockOp('not_document')];
  }

  /** {array<object>} Ops array that will be considered valid. */
  static get VALID_OPS() {
    return [new MockOp('yes')];
  }

  /**
   * Makes a valid op with the indicated name.
   *
   * @param {string} name Name of the op.
   * @returns {object} An op with the indicated name.
   */
  static makeOp(name) {
    return new MockOp(name);
  }

  _impl_isDocument() {
    const op0 = this.ops[0];

    return op0 ? (op0.name !== 'not_document') : true;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClassOrPredicate() {
    return MockOp;
  }
}
