// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

class FakeApiObject {
  constructor() {
    this.initialized = true;
  }

  static get API_NAME() {
    return 'FakeApiObject';
  }

  toApi() {
    return ['fake argument', 0, 1, 2];
  }

  static fromApi(arguments_unused) {
    return new FakeApiObject();
  }
}

/**
 * A collection of methods for creating mock objects needed for Bayou unit
 * testing.
 */
export default class Mocks {
  static nodeRequest(uri = 'http://www.example.com',
                     method = 'GET',
                     headers = { host: 'example.com' },
                     timeout = 10 * 1000,
                     followRedirects = true,
                     maxRedirects = 10) {
    return { uri, method, headers, timeout, followRedirects, maxRedirects };
  }

  static apiObject() {
    return new FakeApiObject();
  }
}
