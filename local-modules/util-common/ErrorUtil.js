// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';
import { UtilityClass } from 'util-core';

/**
 * JSON helper utilities.
 */
export default class JsonUtil extends UtilityClass {
  /**
   * Gets an array of stack lines out of an error, in a consistent format meant
   * to be reasonable for logging.
   *
   * @param {Error} error Error value.
   * @returns {array<string>} Cleaned up error stack as an array of lines, each
   *   one corresponding to one call in the stack.
   */
  static stackLines(error) {
    TObject.check(error, Error);

    const stack = error.stack;

    if (typeof stack !== 'string') {
      return [];
    }

    // Match on each line of the stack that looks like a function/method call
    // (`...at...`). Using `map()` strip each one of the unintersting parts.
    return stack.match(/^ +at .*$/mg).map((line) => {
      // Lines that name functions are expected to be of the form
      // `    at func.name (/path/to/file:NN:NN)`, where `func.name` might
      // actually be `new func.name` or `func.name [as other.name]` (or both).
      let match = line.match(/^ +at ([^()]+) \(([^()]+)\)$/);
      let funcName;
      let filePath;

      if (match) {
        funcName = match[1];
        filePath = match[2];
      } else {
        // Anonymous functions (including top-level code) have the form
        // `    at /path/to/file:NN:NN`.
        match = line.match(/^ +at ([^()]*)$/);
        funcName = '(anon)';
        filePath = match[1];
      }

      const fileSplit = filePath.match(/\/?[^/]+/g) || ['?'];
      const splitLen  = fileSplit.length;
      const fileName  = (splitLen < 2)
        ? fileSplit[0]
        : `...${fileSplit[splitLen - 2]}${fileSplit[splitLen - 1]}`;

      return `${funcName} (${fileName})`;
    });
  }
}
