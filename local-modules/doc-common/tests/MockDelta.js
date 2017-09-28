// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, DataUtil, Errors } from 'util-common';

/**
 * Mock "delta" class for testing.
 */
export default class MockDelta extends CommonBase {
  static get EMPTY() {
    if (!this._EMPTY) {
      this._EMPTY = new MockDelta();
    }
    return this._EMPTY;
  }

  constructor(ops = []) {
    super();

    if (!(Array.isArray(ops) && (ops.length <= 3))) {
      throw Errors.bad_value(ops, 'length 0..3 array');
    }

    this.ops = ops;
    Object.freeze(this);
  }

  isDocument() {
    return this.ops[0] !== 'not_document';
  }

  equals(other) {
    return (other instanceof MockDelta)
      && DataUtil.equalData(this.ops, other.ops);
  }
}
