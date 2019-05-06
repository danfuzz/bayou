// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase } from '@bayou/util-common';

/**
 * Trivial codec-compatible class for use in tests.
 */
export class MockCodable extends CommonBase {
  static get CODEC_TAG() {
    return 'MockCodable';
  }

  constructor(...args) {
    super();

    this.initialized = true;
    this.args        = args;
  }

  deconstruct() {
    return ['fake argument', 0, 1, 2];
  }
}
