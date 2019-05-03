// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TFunction, TString } from '@bayou/typecheck';
import { UtilityClass } from '@bayou/util-common';

import { Action } from './Action';
import { Options } from './Options';
import { TopErrorHandler } from './TopErrorHandler';

/**
 * Top-level logic for starting a server or running server actions (such as unit
 * tests).
 */
export class Server extends UtilityClass {
  /**
   * Starts the server or runs a server action (such as a unit test), based on
   * the given command-line arguments.
   *
   * @param {array<string>} args Command-line arguments to parse and act upon.
   * @param {function} configFunction Function to call in order to perform
   *   system configuration. This is called very early, but _after_ some
   *   fundamental system setup is performed.
   * @returns {Int|null} Process exit code as returned by the action
   *   implementation (see {@link Action#run}), or `null` to indicate that the
   *   process should not exit once the immediate action is complete.
   */
  static async run(args, configFunction) {
    TArray.check(args, TString.check);
    TFunction.checkCallable(configFunction);

    TopErrorHandler.init();

    /** {Options} Parsed command-line arguments / options. */
    const options = new Options(args);

    if (options.errorMessage !== null) {
      // eslint-disable-next-line no-console
      console.log(`${options.errorMessage}\n`);
      options.usage();
      return 1;
    }

    // Perform system configuration, as driven / defined by the caller of this
    // function.
    configFunction();

    // Dispatch the selected top-level action.
    return new Action(options).run();
  }

  /**
   * Calls {@link #run}, and responds to a non-`null` return value by exiting
   * the process.
   *
   * @param {array<string>} args Same as for {@link #run}.
   * @param {function} configFunction Same as for {@link #run}.
   */
  static async runAndExit(args, configFunction) {
    const exitCode = await Server.run(args, configFunction);

    if (exitCode !== null) {
      process.exit(exitCode);
    }
  }
}
