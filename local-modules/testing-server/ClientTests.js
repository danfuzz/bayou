// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { Dirs } from 'server-env';

import Utils from './Utils';

/**
 * Driver for the Mocha framework, for client tests.
 */
export default class ClientTests {
  /**
   * Returns a list of the test files for client modules that are used by the
   * product.
   *
   * @returns {array<string>} Array of module names.
   */
  static allTestFiles() {
    // TODO: Complain about modules that have no tests at all.

    const moduleNames = Utils.localModulesIn(Dirs.CLIENT_DIR);
    const testFiles = Utils.allTestFiles(Dirs.CLIENT_DIR, moduleNames);

    return testFiles;
  }
}
