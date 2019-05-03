// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

import { Dirs } from '@bayou/env-server';
import { UtilityClass } from '@bayou/util-common';

/**
 * Utility to provide lists of test file names (for unit or integration tests),
 * for both the client and server sides.
 */
export class TestFiles extends UtilityClass {
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
   * base directory. This directory is expected to contain a `node_modules`
   * subdirectory, and it is that subdirectory which is scanned.
   *
   * @param {string} productDir Path to the subproduct directory.
   * @returns {array<string>} The bayou-local module names under `dir`.
   */
  static _localModulesIn(productDir) {
    // What we're doing here is looking for each module directory whose
    // `package.json` indicates that it is a `localModule` (which we arrange for
    // in the build). In addition, we perform the same search recursively on
    // directories named with an `@` prefix, on the assumption that those are
    // each a namespace-scope directory containing one or more modules worth
    // scrutinizing.

    const result = [];

    // Looks directly in the indicated directory for local modules. Non-null
    // `scope` (a) names the scope defined by that directory and (b) prevents
    // further recursion (that is, there's no such thing as a sub-scope).
    function findInDir(dir, scope) {
      const allModules = fs.readdirSync(dir);

      for (const name of allModules) {
        if ((scope === null) && name.startsWith('@')) {
          findInDir(path.resolve(dir, name), name);
        } else {
          try {
            const packageData = fs.readFileSync(path.resolve(dir, name, 'package.json'));
            const packageParsed = JSON.parse(packageData);
            if (packageParsed.localModule) {
              result.push((scope === null) ? name : `${scope}/${name}`);
            }
          } catch (e) {
            // Probably no `package.json`. Ignore the (alleged) module.
          }
        }
      }
    }

    findInDir(path.resolve(productDir, 'node_modules'), null);

    return result.sort();
  }
}
