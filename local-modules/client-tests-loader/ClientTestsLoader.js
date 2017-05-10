// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { ClientTests } from 'bayou-mocha';

/**
 * Webpack loader for the client test files.
 */
export default class ClientTestsLoader {
  /**
   * Load the synthesized client test file.
   *
   * @param {string} sourceText_unused The source of the file to load.
   * @returns {string} Result of loading.
   */
  static load(sourceText_unused) {
    const allFiles = ClientTests.allTestFiles();

    // Double stringified because we're emitting quoted source code.
    // TODO: This should do something real with the set of test files.
    const quoteQuoted = JSON.stringify(JSON.stringify(allFiles, null, 2));

    return "import { Logger } from 'see-all';\n" +
      // TODO: The following line breaks because tests require modules `chai`
      // and `mocha`, and adding those to the client dependencies will currently
      // result in a client bundle failure.
      // "import test_AuthorId from 'doc-common/tests/test_AuthorId';\n" +
      "const log = new Logger('client-tests');\n" +
      'export default class ClientTests {\n' +
      `  static run() { log.info(${quoteQuoted}); }\n` +
      '}\n';
  }
}
