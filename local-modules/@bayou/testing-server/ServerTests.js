// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import Mocha from 'mocha';
import { promisify } from 'util';

import { Logger } from '@bayou/see-all';
import { UtilityClass } from '@bayou/util-common';

import { CollectingReporter } from './CollectingReporter';
import { TestFiles } from './TestFiles';

/** {Logger} Logger for this module. */
const log = new Logger('testing');

// One-time setup to hook `chai-as-promised` into the main `chai` module.
chai.use(chaiAsPromised);

/**
 * Driver for the Mocha framework, for server tests.
 */
export class ServerTests extends UtilityClass {
  /**
   * Builds a list of all bayou-local tests, adds them to a test runner,
   * and then executes the tests.
   *
   * @param {string|null} testOut If non-`null`, filesystem path to write the
   *   test output to.
   * @param {RegExp|null} testFilter Filter on test names.
   * @returns {boolean} `true` iff there were any test failures.
   */
  static async run(testOut, testFilter) {
    const testFiles = TestFiles.allServerFiles();

    // The hacky arrangement with `reporterHolder` is how we exfiltrate the
    // reporter instance out of Mocha.
    const reporterHolder = [];
    const mocha = new Mocha({
      grep:            testFilter || /./,
      reporter:        CollectingReporter,
      reporterOptions: { holder: reporterHolder },
      timeout:         10 * 1000 // Ten seconds.
    });

    log.info('Initializing server tests...');

    for (const f of testFiles) {
      mocha.addFile(f);
    }

    log.info('Running server tests...');

    const failures  = await promisify(cb => mocha.run(f => cb(null, f)))();
    const reporter  = reporterHolder[0];
    const collector = reporter.collector;

    if (testOut !== null) {
      const output = collector.resultLines.join('\n');
      fs.writeFileSync(testOut, output);
      log.info('Wrote test results to file:', testOut);
    }

    return (failures !== 0);
  }
}
