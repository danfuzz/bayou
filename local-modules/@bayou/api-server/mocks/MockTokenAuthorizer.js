// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BearerToken } from '@bayou/api-common';
import { BaseTokenAuthorizer } from '@bayou/api-server';

/**
 * Mock `BaseTokenAuthorizer` for testing.
 */
export class MockTokenAuthorizer extends BaseTokenAuthorizer {
  get _impl_nonTokenPrefix() {
    return 'nontoken-';
  }

  async _impl_cookieNamesForToken(value_unused) {
    return [];
  }

  async _impl_getAuthorizedTarget(token_unused, cookies_unused) {
    return { some: 'authority' };
  }

  _impl_isToken(tokenString_unused) {
    return true;
  }

  _impl_tokenFromString(tokenString) {
    return new BearerToken(tokenString, tokenString);
  }
}
