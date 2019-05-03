// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseChange } from '@bayou/ot-common';

import { FileDelta } from './FileDelta';

/**
 * Change class for representing changes to a file (writing and/or deleting
 * blobs and/or paths). The `delta`s passed to the constructor must be instances
 * of {@link FileDelta}.
 */
export class FileChange extends BaseChange {
  /** @override */
  static get _impl_deltaClass() {
    return FileDelta;
  }
}
