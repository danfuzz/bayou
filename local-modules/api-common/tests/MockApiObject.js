// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Trivial API-compatible class for use in tests.
 */
export default class MockApiObject {
  constructor() {
    this.initialized = true;
  }

  static get API_NAME() {
    return 'MockApiObject';
  }

  toApi() {
    return ['fake argument', 0, 1, 2];
  }

  static fromApi(arguments_unused) {
    return new MockApiObject();
  }
}
