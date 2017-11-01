// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TInt } from 'typecheck';
import { UtilityClass } from 'util-core';

/**
 * A set of utiity functions for conversion and display of
 * unit values.
 */
export default class Units extends UtilityClass {
  /**
   * Converts a byte count to a human-friendly display string.
   *
   * @param {Int} bytes The size of the file, in bytes. Negative values
   *   are not allowed.
   * @param {Int} [decimalPlaces = 0] The number of decimal places
   *   to have in the output, with a maximum of 4.
   * @returns {string} The display string.
   */
  static filesizeToString(bytes, decimalPlaces = 0) {
    TInt.nonNegative(bytes);
    TInt.nonNegative(decimalPlaces);
    TInt.maxInc(decimalPlaces, 4);

    const divisor = 1024;

    if (Math.abs(bytes) < divisor) {
      // TODO: this should be replaced with proper i18n selectors when we
      //       have an i18n framework in place.
      switch (bytes) {
        case 0: {
          return `${bytes} bytes`;
        }

        case 1: {
          return `${bytes} byte`;
        }

        case 2: {
          return `${bytes} bytes`;
        }

        default: {
          return `${bytes} bytes`;
        }
      }
    }

    // TODO: i18n check - are these universally accepted units?
    const units = ['kB', 'MB', 'GB', 'TB'];
    let power = -1;

    do {
      bytes /= divisor;
      power += 1;
    } while (Math.abs(bytes) >= divisor && power < units.length - 1);

    // Don't allow anything petabyte or larger because JavaScript numbers
    // can't represent them with safe integers.
    TInt.maxInc(power, 3);

    // TODO: When we have an i18n framework we'll need to make sure we're
    //       generating proper thousands and decimal separators. Also
    //       check for whether the space before the units is locale-specific.
    return decimalPlaces
      ? `${bytes.toFixed(decimalPlaces)} ${units[power]}`
      : `${Math.round(bytes)} ${units[power]}`;
  }
}
