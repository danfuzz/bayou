// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseControl } from './BaseControl';

/**
 * Base class for _ephemeral_ document part controllers. Ephemeral parts do not
 * maintain full change history. Instead, they keep a stored snapshot of _some_
 * revision along with all subsequent changes. Every so often, the stored
 * snapshot gets updated, at which point earlier changes are able to be deleted.
 *
 * **Note:** The actual differences in behavior between instances of this class
 * and instances of {@link EphemeralControl} are defined in the superclass,
 * which merely keys off of the value of the static property {@link #ephemeral}
 * defined here.
 */
export class EphemeralControl extends BaseControl {
  /**
   * {boolean} Whether (`true`) or not (`false`) this instance controls an
   * ephemeral part. Defined as `true` for this class.
   */
  static get ephemeral() {
    return true;
  }
}
