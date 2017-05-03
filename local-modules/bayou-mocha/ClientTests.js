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
   * Returns a list of the client modules that are used by the product. This
   * includes modules that have no tests, explicitly so that those can be
   * called out in reports as needing tests.
   *
   * @returns {array<string>} Array of module names.
   */
  static moduleNames() {
    return Utils.localModulesIn(Dirs.CLIENT_DIR);
  }
}
