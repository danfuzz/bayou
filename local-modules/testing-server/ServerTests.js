// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Mocha from 'mocha';

import { Dirs } from 'server-env';
import { UtilityClass } from 'util-common';

import Utils from './Utils';

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
   * @returns {number} Count of test failures, which resolves after testing is
   *   complete.
   */
  static async runAll() {
    // TODO: Complain about modules that have no tests at all.

    const moduleNames = Utils.localModulesIn(Dirs.theOne.SERVER_DIR);
    const testFiles = Utils.allTestFiles(Dirs.theOne.SERVER_DIR, moduleNames);
    const mocha = new Mocha();

    for (const f of testFiles) {
      mocha.addFile(f);
    }

    return new Promise((res, rej_unused) => {
      mocha.run((failures) => { res(failures); });
    });
  }
}
