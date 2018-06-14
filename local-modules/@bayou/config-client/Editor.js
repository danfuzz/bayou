// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { use } from '@bayou/injecty';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility functionality regarding the setup of interactive editors.
 */
export default class Editor extends UtilityClass {
  /**
   * Performs any webpage-global setup needed in order for the page to host one
   * or more editors. This is called exactly once per page load, early during
   * initialization and specifically _before_ any programmatic DOM manipulation
   * has been done by the system.
   *
   * @param {object} window Window which will ultimately contain one or more
   *   editors.
   * @param {string} baseUrl Base URL that points to the server to use.
   * @returns {Promise|undefined} A promise whose resolution indicates the end
   *   of hook activity, or `undefined` if there is nothing to wait for.
   */
  static aboutToRun(window, baseUrl) {
    return use.Editor.aboutToRun(window, baseUrl);
  }
}
