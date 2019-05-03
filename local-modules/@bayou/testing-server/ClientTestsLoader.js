// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { UtilityClass } from '@bayou/util-common';

import { TestFiles } from './TestFiles';

/**
 * Webpack loader for the client test files. This gets imported by Webpack via
 * the file `loadClientTests.js`.
 */
export class ClientTestsLoader extends UtilityClass {
  /**
   * Load the synthesized client test file.
   *
   * @param {string} sourceText_unused The source of the file to load.
   * @returns {string} Result of loading.
   */
  static load(sourceText_unused) {
    const result = [];

    // The `map()` removes the path prefix just leaving the module name and
    // subdirectory path underneath it along with the file name _without_ the
    // `.js` suffix.
    const allFiles = TestFiles.allClientFiles().map((file) => {
      return file.replace(/^.*[/]node_modules[/](.*)\.js$/,
        (match_unused, group1) => { return group1; });
    });

    result.push('function registerTests() {\n');

    for (const file of allFiles) {
      result.push('  require(');
      result.push(JSON.stringify(file));
      result.push(');\n');
    }

    result.push('}\n');
    result.push('export { registerTests };\n');

    return result.join('');
  }
}
