// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the setup of interactive editors.
 */
export default class Editor extends UtilityClass {
  /**
   * Implementation of standard configuration point. This implementation is a
   * no-op.
   *
   * @param {object} window_unused Window which will ultimately contain one or
   *   more editors.
   * @param {string} baseUrl_unused Base URL that points to the server to use.
   */
  aboutToRun(window_unused, baseUrl_unused) {
    // This space intentionally left blank.
  }
}
