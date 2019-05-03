// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

// **Note:** Babel's browser polyfill includes a Node-compatible `crypto`
// module, which is why this is possible to import regardless of environment.
import crypto from 'crypto';

import { TString } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-core';

/**
 * Several (hopefully) useful routines to make dealing with strings a little
 * nicer.
 */
export class StringUtil extends UtilityClass {
  /**
   * Produces a 32-bit integer hashcode for the given string. This uses a
   * cryptographic hash to provide good value distribution.
   *
   * @param {string} string The string in question.
   * @returns {Int} The corresponding hashcode.
   */
  static hash32(string) {
    TString.check(string);
    const hash = crypto.createHash('sha256'); // Good enough for 32-bit output.

    hash.update(string, 'utf8');
    return parseInt(hash.digest('hex').slice(0, 8), 16);
  }
}
