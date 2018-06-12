// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the deployment configuration of a server.
 */
export default class Deployment extends UtilityClass {
  /**
   * Checks to see if this server is running in a "development" environment,
   * returning an indication of the fact. A development environment is notable
   * in that it notices when source files change (and acts accordingly), has
   * `/debug` endpoints enabled, and may be less secure in other ways as a
   * tradeoff for higher internal visibility, that is, higher debugability.
   *
   * @returns {boolean} `true` if this server is running in a development
   *   environment, or `false` if not.
   */
  static isRunningInDevelopment() {
    return use.Deployment.isRunningInDevelopment();
  }
}
