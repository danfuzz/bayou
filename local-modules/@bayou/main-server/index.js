#!/usr/bin/env node
// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { injectAll } from '@bayou/config-common-default';
import { Action, Options, TopErrorHandler } from '@bayou/server-top';

TopErrorHandler.init();

/** {Options} Parsed command-line arguments / options. */
const options = new Options(process.argv);

if (options.errorMessage !== null) {
  // eslint-disable-next-line no-console
  console.log(`${options.errorMessage}\n`);
  options.usage();
  process.exit(1);
}

// Inject all the system configs. **TODO:** This module needs to be split
// apart such that a _different_ "main" module can choose to perform different
// configuration and still reuse most of the code defined in _this_ module.
injectAll();

// Dispatch the selected top-level action.
(async () => {
  const resultPromise = new Action(options).run();
  const exitCode      = await resultPromise;

  if (exitCode !== null) {
    process.exit(exitCode);
  }
})();
