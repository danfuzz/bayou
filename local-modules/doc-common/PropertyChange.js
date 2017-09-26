// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseChange from './BaseChange';
import PropertyDelta from './PropertyDelta';

/**
 * Change class for representing changes to one or more document properties
 * (that is, the structured document metadata). The `delta`s passed to the
 * constructor must be instances of {@link PropertyDelta}.
 */
export default class PropertyChange extends BaseChange {
  /**
   * {class} Class (constructor function) of delta objects to be used with
   * instances of this class.
   */
  static get _impl_deltaClass() {
    return PropertyDelta;
  }
}
