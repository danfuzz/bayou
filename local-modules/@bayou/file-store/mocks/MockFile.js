// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseFile } from '@bayou/file-store';

/**
 * Trivial {@link BaseFile} implementation for use with the tests.
 */
export class MockFile extends BaseFile {
  appendChange() {
    return true;
  }
}
