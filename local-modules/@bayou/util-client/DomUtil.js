// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

/**
 * DOM helper utilities.
 */
export default class DomUtil extends UtilityClass {
  /**
   * Adds a stylesheet to the given document by URL, returning a promise that
   * resolves when it is fully loaded.
   *
   * @param {Document} document Document to add to.
   * @param {string} url URL of the stylesheet.
   * @returns {Promise<true>} Promise that resolves when the stylesheet has
   *   been loaded.
   */
  static addStylesheet(document, url) {
    return new Promise((res, rej_unused) => {
      const elem = document.createElement('link');
      elem.href = url;
      elem.rel = 'stylesheet';
      elem.onload = () => { res(true); };

      document.head.appendChild(elem);

      // TODO: Consider rejecting the promise after a timeout if loading was
      // apparently unsuccessful.
    });
  }
}
