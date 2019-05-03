// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseControl } from './BaseControl';

/**
 * Base class for _durable_ document part controllers. Durable parts maintain
 * full change history (as opposed to _ephemeral_ parts which do not).
 *
 * **Note:** The actual differences in behavior between instances of this class
 * and instances of {@link EphemeralControl} are defined in the superclass,
 * which merely keys off of the value of the static property {@link #ephemeral}
 * defined here.
 */
export class DurableControl extends BaseControl {
  /**
   * {boolean} Whether (`true`) or not (`false`) this instance controls an
   * ephemeral part. Defined as `false` for this class.
   */
  static get ephemeral() {
    return false;
  }
}
