// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseDelta } from '@bayou/ot-common';

import { MockOp } from './MockOp';

/**
 * Mock "delta" class for testing.
 */
export class MockDelta extends BaseDelta {
  /** {array<object>} Would-be ops array that contains an invalid element. */
  static get INVALID_OPS() {
    return ['not_an_op'];
  }

  /**
   * {array<object>} Ops array that will indicate that the delta is not a
   * document.
   */
  static get NOT_DOCUMENT_OPS() {
    return [new MockOp('notDocument')];
  }

  /** {array<object>} Ops array that will be considered valid. */
  static get VALID_OPS() {
    return [new MockOp('yes')];
  }

  _impl_compose(other, wantDocument) {
    const resultName = wantDocument ? 'composedDoc' : 'composedNotDoc';
    let   resultArg  = 1;
    const op0        = this.ops[0];

    if (op0 && op0.name.startsWith(resultName)) {
      // The first op gets an argument which is a running tally of how many
      // times composition happened.
      resultArg = op0.arg0 + 1;
    }

    const thisClass = this.constructor;
    return new thisClass([new MockOp(resultName, resultArg), ...other.ops]);
  }

  _impl_isDocument() {
    const op0 = this.ops[0];

    return op0 ? (op0.name !== 'notDocument') : true;
  }

  /**
   * {class} Class (constructor function) of operation objects to be used with
   * instances of this class.
   */
  static get _impl_opClass() {
    return MockOp;
  }
}
