// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { UtilityClass } from 'util-common';

/**
 * Utilities for this module.
 */
export default class Utils extends UtilityClass {
  /**
   * Gets a list of the names of Bayou local modules under the given subproduct
   * base directory.
   *
   * @param {string} dir Path to the subproduct directory.
   * @returns {array<string>} The bayou-local module names under `dir`.
   */
  static localModulesIn(dir) {
    // What we're doing here is looking for module directories whose
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

  /**
   * Gets a list of filesystem paths for all the test source files in the
   * indicated modules under the given subproduct base directory. The results
   * are all `.js` files that live in a `tests` directory directly under the
   * main module directory.
   *
   * @param {string} dir Path to the subproduct directory.
   * @param {array<string>} moduleList A list of module names to scan for tests,
   *   such as might have been returned from a call to `localModulesIn()`.
   * @returns {array<string>} List of test file paths.
   */
  static allTestFiles(dir, moduleList) {
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
}
