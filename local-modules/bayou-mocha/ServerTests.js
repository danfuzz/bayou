// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import Mocha from 'mocha';
import fs from 'fs';
import path from 'path';

import { Dirs } from 'server-env';

import Utils from './Utils';

/**
 * Driver for the Mocha framework, for server tests.
 */
export default class ServerTests {
  /**
   * Builds a list of all bayou-local tests, adds them to a test runner,
   * and then executes the tests.
   *
   * @param {function|null} [callback = null] Callback which is called when
   *   testing is complete. Gets passed a `failures` value. Ignored if passed
   *   as `null`.
   */
  static runAll(callback = null) {
    const bayouModules = Utils.localModulesIn(Dirs.SERVER_DIR);
    const testPaths = ServerTests._testPathsForModules(bayouModules);
    const mocha = new Mocha();

    testPaths.forEach((testPath) => {
      const allFiles = fs.readdirSync(testPath);
      const jsFiles = allFiles.filter(file => /\.js$/.test(file));

      jsFiles.forEach((file) => {
        mocha.addFile(path.join(testPath, file));
      });
    });

    mocha.run((failures) => {
      if (callback !== null) {
        callback(failures);
      }
    });
  }

  /**
   * Returns a list of filesystem paths for modules that
   * have a `tests` directory.
   *
   * @param {array<string>} moduleList A list of module names to scan for tests.
   * @returns {array<string>} The bayou-local module names
   */
  static _testPathsForModules(moduleList) {
    const potentialTestPaths = moduleList.map((module) => {
      const modulePath = path.dirname(require.resolve(module));

      return path.join(modulePath, 'tests');
    });

    return potentialTestPaths.filter((potentialTestPath) => {
      return fs.existsSync(potentialTestPath);
    });
  }
}
