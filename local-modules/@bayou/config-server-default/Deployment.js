// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the deployment configuration of a server.
 */
export default class Deployment extends UtilityClass {
  /**
   * Implementation of standard configuration point.
   *
   * This implementation always returns `true`.
   *
   * @returns {boolean} `true`, always.
   */
  static isRunningInDevelopment() {
    return true;
  }
}
