// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Editor initialization
 *
 * This file is directly loaded from pages that include an editor. See {@link
 * TopControl} for info on how bootstrap parameters get passed into the
 * system.
 */

import { ClientEnv } from '@bayou/env-client';
import { Logger } from '@bayou/see-all';
import { ClientSink } from '@bayou/see-all-client';
import { UtilityClass } from '@bayou/util-common';

import TopControl from './TopControl';

/** {Logger} Logger for this module. */
const log = new Logger('page-init');

/**
 * Top-level logic for starting a client or running client unit tests.
 */
export default class Client extends UtilityClass {
  /**
   * Starts up a client in the current window.
   *
   * @param {function} configFunction Function to call in order to perform
   *   system configuration. This is called very early, but _after_ some
   *   fundamental system setup is performed.
   */
  static async run(configFunction) {
    Client._init(configFunction, 'Starting...');

    const control = new TopControl(window);
    log.detail('Made `control`.');

    await control.start();
    log.info('Now running!');
  }

  /**
   * Runs the client unit tests.
   *
   * @param {function} configFunction Function to call in order to perform
   *   system configuration.
   * @param {class} testsClass The class `@bayou/testing-client/Tests`. This is
   *   passed in instead of represented directly here, so as to avoid creating a
   *   dependency from this file on the tests, which would "infect" the non-test
   *   use of this file (and notably cause the test code to get bundled into a
   *   non-test client bundle).
   */
  static async runUnitTests(configFunction, testsClass) {
    Client._init(configFunction, 'Starting up testing environment...');

    const testFilter = window.BAYOU_TEST_FILTER || null;

    const elem = document.createElement('p');
    elem.innerHTML = 'Running&hellip;';
    document.body.appendChild(elem);

    (async () => {
      const failures = await testsClass.runAll(testFilter);

      let msg;
      switch (failures) {
        case 0:  { msg = 'All good! Yay!';                         break; }
        case 1:  { msg = 'Alas, there was one failure.';           break; }
        default: { msg = `Alas, there were ${failures} failures.`; break; }
      }

      elem.innerHTML = msg;
    })();
  }

  /**
   * Helper which performs basic initialization.
   *
   * @param {function} configFunction Function to call in order to perform
   *   system configuration.
   * @param {string} msg Message to log to indicate startup is in progress.
   */
  static _init(configFunction, msg) {
    // Init logging.
    ClientSink.init();
    log.info(msg);

    // Inject all the system configs.
    configFunction();
    log.detail('System configured.');

    // Init the environment utilities.
    ClientEnv.init(window);
  }
}
