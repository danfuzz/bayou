// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseChange } from '@bayou/ot-common';

import { CaretDelta } from './CaretDelta';

/**
 * Change class for representing changes to caret snapshots. The `delta`s passed
 * to the constructor must be instances of {@link CaretDelta}.
 */
export class CaretChange extends BaseChange {
  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class.
   */
  static get _impl_deltaClass() {
    return CaretDelta;
  }
}
