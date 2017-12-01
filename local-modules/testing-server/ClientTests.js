// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';

import { Logger } from 'see-all';
import { UtilityClass } from 'util-common';

/** {Logger} Logger for this module. */
const log = new Logger('testing');

/**
 * Driver for the Mocha framework, for client tests.
 */
export default class ClientTests extends UtilityClass {
  /**
   * Sets up and runs client tests, using a captive browser environment.
   *
   * @param {string|null} testOut If non-`null`, filesystem path to write the
   *   test output to.
   * @returns {number} Count of test failures, which resolves after testing is
   *   complete.
   */
  static async runAll(testOut) {
    // **TODO:** Fill this in.

    if (testOut !== null) {
      const output = 'TODO\n';
      fs.writeFileSync(testOut, output);
      log.info('Wrote test results to file:', testOut);
    }

    return 0;
  }
}
