// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { PromDelay } from 'util-common';

/**
 * DOM helper utilities.
 */
export default class DomUtil {
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
    const elem = document.createElement('link');
    elem.href = url;
    elem.rel = 'stylesheet';
    document.head.appendChild(elem);

    return new Promise((res, rej_unused) => {
      function check() {
        for (const s of document.styleSheets) {
          if ((s.href === url) && s.rules && (s.rules.length !== 0)) {
            // The stylesheet appears to be loaded.
            res(true);
            return;
          }
        }

        // Not yet loaded. Wait a moment and try again. TODO: Consider rejecting
        // the promise after a (longer) timeout.
        PromDelay.resolve(100).then(check);
      }

      PromDelay.resolve(10).then(check);
    });
  }
}
