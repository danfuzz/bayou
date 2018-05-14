// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { UtilityClass } from '@bayou/util-common';

// **Note:** This is really the local module `mocha-client-shim`. See that
// module and {@link client-bundle.ClientBundle} for more details.
import { Mocha } from 'mocha';

// This file is dynamically-generated when loaded. See comments in the file for
// more info.
import { registerTests } from './client-tests';

import EventReporter from './EventReporter';

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Driver for the Mocha framework, for client tests. This gets run by the
 * client-side `boot-for-test` script, which is operated at "arm's length" by
 * {@link testing-server.ClientTests}.
 */
export default class Tests extends UtilityClass {
  /**
   * Runs all of the tests.
   *
   * @returns {number} The number of test failures as reported by the
   *   `mocha.run()` callback.
   */
  static async runAll() {
    const mocha = new Mocha({
      reporter: EventReporter,
      ui:       'bdd'
    });

    // Find all of our test files and load them into the runtime. The
    // process of loading the modules also registers all of the tests with
    // mocha. **Note:** This has to be done _after_ we construct `mocha` above,
    // due our janky setup for making modules testable at all on the client.
    // The "sausage factory" in question is the local module `mocha-client-shim`
    // (see which for the gory details).
    registerTests();

    return new Promise((res, rej_unused) => {
      mocha.run(res);
    });
  }
}
