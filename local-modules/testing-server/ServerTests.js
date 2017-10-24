// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import Mocha from 'mocha';
import { promisify } from 'util';

import { Dirs } from 'env-server';
import { Logger } from 'see-all';
import { UtilityClass } from 'util-common';

import CollectingReporter from './CollectingReporter';
import Utils from './Utils';

/** {Logger} Logger for this module. */
const log = new Logger('testing');

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Driver for the Mocha framework, for server tests.
 */
export default class ServerTests extends UtilityClass {
  /**
   * Builds a list of all bayou-local tests, adds them to a test runner,
   * and then executes the tests.
   *
   * @param {string|null} testOut If non-`null`, filesystem path to write the
   *   test output to.
   * @returns {number} Count of test failures, which resolves after testing is
   *   complete.
   */
  static async runAll(testOut) {
    // TODO: Complain about modules that have no tests at all.

    const moduleNames = Utils.localModulesIn(Dirs.theOne.SERVER_DIR);
    const testFiles = Utils.allTestFiles(Dirs.theOne.SERVER_DIR, moduleNames);

    // The hacky arrangement with `reporterHolder` is how we exfiltrate the
    // reporter instance out of Mocha.
    const reporterHolder = [];
    const mocha = new Mocha({
      reporter: CollectingReporter,
      reporterOptions: { holder: reporterHolder }
    });

    log.info('Initializing server tests...');

    for (const f of testFiles) {
      mocha.addFile(f);
    }

    log.info('Running server tests...');

    const failures = await promisify((cb) => { mocha.run(cb); })();

    if (testOut !== null) {
      const output = reporterHolder[0].resultLines().join('\n');
      fs.writeFileSync(testOut, output);
      log.info('Wrote test results to file:', testOut);
    }

    return failures;
  }
}
