// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import BaseControl from './BaseControl';

/**
 * Base class for _ephemeral_ document part controllers. Ephemeral parts do not
 * maintain full change history. Instead, they keep a stored snapshot of _some_
 * revision along with all subsequent changes. Every so often, the stored
 * snapshot gets updated, at which point earlier changes are able to be deleted.
 */
export default class EphemeralControl extends BaseControl {
  /**
   * {boolean} Whether (`true`) or not (`false`) this instance controls an
   * ephemeral part. Defined as `true` for this class.
   */
  get ephemeral() {
    return true;
  }
}
