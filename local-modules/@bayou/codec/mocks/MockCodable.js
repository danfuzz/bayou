// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Trivial codec-compatible class for use in tests.
 */
export default class MockCodable {
  static get CODEC_TAG() {
    return 'MockCodable';
  }

  constructor(...args) {
    this.initialized = true;
    this.args        = args;
  }

  deconstruct() {
    return ['fake argument', 0, 1, 2];
  }
}
