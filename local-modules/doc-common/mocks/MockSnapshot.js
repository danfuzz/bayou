// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from 'doc-common';

import MockChange from './MockChange';
import MockOp from './MockOp';

/**
 * Mock subclass of `BaseSnapshot` for testing.
 */
export default class MockSnapshot extends BaseSnapshot {
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  _impl_composeWithDelta(delta) {
    let resultName = 'composed_delta';
    const op0 = this.contents.ops[0];

    if (op0 && op0.name.startsWith(resultName)) {
      // The first op gets a `_` suffix on its name for each additional
      // composition.
      resultName = op0.name + '_';
    }

    return [new MockOp(resultName), ...delta.ops];
  }

  _impl_diffAsDelta(newerSnapshot) {
    return [new MockOp('diff_delta'), newerSnapshot.contents.ops[0]];
  }

  static get _impl_changeClass() {
    return MockChange;
  }
}
