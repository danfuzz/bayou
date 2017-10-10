// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from 'doc-common';

/**
 * Mock operation class for testing.
 */
export default class MockOp extends BaseOp {
  /**
   * Makes a valid op with the indicated name.
   *
   * @param {string} name Name of the op.
   * @returns {object} An op with the indicated name.
   */
  static make(name) {
    return new MockOp(name);
  }

  get name() {
    return this.payload.name;
  }
}
