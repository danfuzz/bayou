// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseChange } from '@bayou/ot-common';

import { MockDelta } from './MockDelta';

/**
 * Mock subclass of `BaseChange` for testing.
 */
export class MockChange extends BaseChange {
  static get _impl_deltaClass() {
    return MockDelta;
  }
}
