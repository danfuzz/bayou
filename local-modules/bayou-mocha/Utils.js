// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import fs from 'fs';
import path from 'path';

/**
 * Utilities for this module.
 */
export default class Utils {
  /**
   * Gets a list of the names of Bayou local modules under the given subproduct
   * base directory.
   *
   * @param {string} dir Path to the subproduct directory.
   * @returns {array<string>} The bayou-local module names under `dir`.
   */
  static localModulesIn(dir) {
    const packageData = fs.readFileSync(path.resolve(dir, 'package.json'));
    const packageParsed = JSON.parse(packageData);
    const dependencies = packageParsed['dependencies'];
    const modules = Object.keys(dependencies);

    return modules.filter((module) => {
      return dependencies[module].indexOf('local-modules/') >= 0;
    });
  }
}
