// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseOp } from '@bayou/ot-common';

/**
 * Mock operation class for testing.
 */
export default class MockOp extends BaseOp {
  get name() {
    return this.payload.name;
  }
}
