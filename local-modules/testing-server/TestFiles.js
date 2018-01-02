// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Dirs } from 'env-server';
import { UtilityClass } from 'util-common';

/**
 * Utility to provide lists of test file names (for unit or integration tests),
 * for both the client and server sides.
 */
export default class TestFiles extends UtilityClass {
  /**
   * Returns a list of the test files for client modules that are used by the
   * product.
   *
   * @returns {array<string>} Array of filesystem paths for client test files.
   */
  static allClientFiles() {
    // TODO: Complain about modules that have no tests at all.

    const moduleNames = this._localModulesIn(Dirs.theOne.CLIENT_DIR);
    const testFiles = this._allTestFiles(Dirs.theOne.CLIENT_DIR, moduleNames);

    return testFiles;
  }

  /**
   * Returns a list of the test files for server modules that are used by the
   * product.
   *
   * @returns {array<string>} Array of filesystem paths for server test files.
   */
  static allServerFiles() {
    // TODO: Complain about modules that have no tests at all.

    const moduleNames = this._localModulesIn(Dirs.theOne.SERVER_DIR);
    const testFiles = this._allTestFiles(Dirs.theOne.SERVER_DIR, moduleNames);

    return testFiles;
  }

  /**
   * Gets a list of filesystem paths for all the test source files in the
   * indicated modules under the given subproduct base directory. The results
   * are all `.js` files that live in a `tests` directory directly under a
   * main module directory.
   *
   * @param {string} dir Path to the subproduct directory.
   * @param {array<string>} moduleList A list of module names to scan for tests,
   *   such as might have been returned from a call to
   *   {@link #_localModulesIn()}.
   * @returns {array<string>} List of filesystem paths for test files.
   */
  static _allTestFiles(dir, moduleList) {
    const testsDirs = moduleList.map((name) => {
      return path.resolve(dir, 'node_modules', name, 'tests');
    });

    const result = [];
    for (const testsDir of testsDirs) {
      if (!fs.existsSync(testsDir)) {
        continue;
      }

      const allFiles = fs.readdirSync(testsDir);
      const jsFiles = allFiles.filter(file => /^test_.*\.js$/.test(file)).sort();
      for (const f of jsFiles) {
        result.push(path.resolve(testsDir, f));
      }
    }

    return result;
  }

  /**
   * Gets a list of the names of Bayou local modules under the given subproduct
   * base directory.
   *
   * @param {string} dir Path to the subproduct directory.
   * @returns {array<string>} The bayou-local module names under `dir`.
   */
  static _localModulesIn(dir) {
    // What we're doing here is looking for each module directory whose
    // `package.json` indicates that it is a `localModule` (which we arrange for
    // in the build).

    const allModules = fs.readdirSync(path.resolve(dir, 'node_modules'));
    const modules = allModules.filter((name) => {
      try {
        const packageData = fs.readFileSync(
          path.resolve(dir, 'node_modules', name, 'package.json'));
        const packageParsed = JSON.parse(packageData);
        return packageParsed.localModule;
      } catch (e) {
        // Probably no `package.json`.
        return false;
      }
    });

    return modules.sort();
  }
}
