// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from 'doc-common';

import MockOp from './MockOp';

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

  _impl_compose(other, wantDocument) {
    let resultName = wantDocument ? 'composed_doc' : 'composed_not_doc';
    const op0 = this.ops[0];

    if (op0 && op0.name.startsWith(resultName)) {
      // The first op gets a `_` suffix on its name for each additional
      // composition.
      resultName = op0.name + '_';
    }

    return new MockDelta([new MockOp(resultName), ...other.ops]);
  }

  _impl_isDocument() {
    const op0 = this.ops[0];

    return op0 ? (op0.name !== 'not_document') : true;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return MockOp;
  }
}
