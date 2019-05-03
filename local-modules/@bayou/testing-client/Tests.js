// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { UtilityClass } from '@bayou/util-common';

// **Note:** This is really the local module `@bayou/mocha-client-shim`. See
// that module and {@link @bayou/client-bundle.ClientBundle} for more details.
import { Mocha } from 'mocha';

// This file is dynamically-generated when loaded. See comments in the file for
// more info.
import { registerTests } from './client-tests';

import { EventReporter } from './EventReporter';

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Driver for the Mocha framework, for client tests. This gets run by the
 * client-side `boot-for-test` script, which is operated at "arm's length" by
 * {@link @bayou/testing-server.ClientTests}.
 */
export class Tests extends UtilityClass {
  /**
   * Runs all of the tests, or all of the ones that pass the indicated filter.
   *
   * @param {RegExp|null} [testFilter = null] Regular expression used on test
   *   names.
   * @returns {number} The number of test failures as reported by the
   *   `mocha.run()` callback.
   */
  static async runAll(testFilter = null) {
    const mocha = new Mocha({
      grep:     testFilter || /./,
      reporter: EventReporter,
      ui:       'bdd'
    });

    // Find all of our test files and load them into the runtime. The process of
    // loading the modules also registers all of the tests with mocha. **Note:**
    // This has to be done _after_ we construct `mocha` above, due our janky
    // setup for making modules testable at all on the client. The "sausage
    // factory" in question is the local module `@bayou/mocha-client-shim` (see
    // which for the gory details).
    registerTests();

    return new Promise((resolve) => {
      mocha.run(resolve);
    });
  }
}
