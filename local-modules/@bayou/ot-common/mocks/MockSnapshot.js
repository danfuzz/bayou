// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseSnapshot } from '@bayou/ot-common';

import { MockChange } from './MockChange';
import { MockOp } from './MockOp';

/**
 * Mock subclass of `BaseSnapshot` for testing.
 */
export class MockSnapshot extends BaseSnapshot {
  constructor(revNum, contents) {
    super(revNum, contents);
    Object.freeze(this);
  }

  // TODO: Fill in for testing purposes
  checkPathIs() {
    return true;
  }

  // TODO: Fill in for testing purposes
  checkPathAbsent() {
    return true;
  }

  // TODO: Fill in for testing purposes
  checkPathPresent() {
    return true;
  }

  // TODO: Fill in for testing purposes
  getOrNull() {
    return null;
  }

  _impl_diffAsDelta(newerSnapshot) {
    return [new MockOp('diffDelta'), newerSnapshot.contents.ops[0]];
  }

  _impl_validateChange() {
    return true;
  }

  static get _impl_changeClass() {
    return MockChange;
  }
}
