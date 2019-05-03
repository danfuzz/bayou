// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';
import minimist from 'minimist';

import { TArray, TString } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-common';

import { Action } from './Action';

/**
 * Command-line option parsing.
 */
export class Options extends CommonBase {
  /**
   * Constructs an instance, which in the process parses the command-line
   * options.
   *
   * @param {array<string>} argv Command-line argument array, in the format
   *   provided by `process.argv`.
   */
  constructor(argv) {
    TArray.check(argv, TString.check);

    super();

    this._options = Object.freeze(Options._parseOptions(argv));
  }

  /** {string} The action to take. */
  get action() {
    return this._options.action;
  }

  /**
   * {string|null} Error message describing a problem with the command-line
   * options, or `null` if there was no error.
   */
  get errorMessage() {
    return this._options.errorMessage;
  }

  /**
   * {boolean} If `true`, indicates that console logs should be written in a
   * human-friendly (not machine-readable) format.
   */
  get humanConsole() {
    return this._options.humanConsole;
  }

  /** {string} What to use as the program name for logging and messaging. */
  get progName() {
    return this._options.progName;
  }

  /**
   * {RegExp|null} Regular expression which must match a test name in order for
   * that test to be run, or `null` if either this isn't a test run or all tests
   * are to be run.
   */
  get testFilter() {
    return this._options.testFilter;
  }

  /**
   * {string|null} Filesystem path naming a directory into which test results
   * should be placed, or `null` if either this isn't a test run or results
   * should merely be written to the console.
   */
  get testOut() {
    return this._options.testOut;
  }

  /**
   * Writes the usage message to the console. **Note:** This is an instance
   * method because it mentions the program name.
   */
  usage() {
    const progName = this.progName;

    [
      'Usage:',
      '',
      `${progName} [<action>] [<opt>...]`,
      '',
      '  Run the project.',
      '',
      '  Action options (at most one may be specified):',
      '',
      '    --client-bundle',
      '      Just build a client bundle, and report any errors encountered.',
      '    --client-test',
      '      Just run the client tests (via headless Chrome), and report any errors',
      '      encountered.',
      '    --dev',
      '      Run in development mode, for interactive development without having',
      '      to restart when client code changes, and to automatically exit when',
      '      server code changes. (The `develop` script automatically rebuilds and',
      '      restarts when the latter happens.) This option also enables `/debug`',
      '      application endpoints.',
      '    --dev-if-appropriate',
      '      Run in development mode (per above), but only if the execution environment',
      '      indicates that it is meant to be so run. (This is determined by a',
      '      configuration in `@bayou/config-server/Deployment`, see which.) If not',
      '      appropriate to run in development mode, this will run in production mode.',
      '    --production',
      '      Run in production (not development) mode. This is the default action if',
      '      none is specified.',
      '    --server-test',
      '      Just run the server tests, and report any errors encountered.',
      '',
      '  Other options:',
      '',
      '    --human-console',
      '      Provide human-oriented logging output on `stdout`. The default is to write',
      '      JSON-encoded event records.',
      '    --prog-name=<name>',
      '      Name of this program, for use when reporting errors and diagnostics.',
      '    --test-filter=<regex>',
      '      When running tests, only run ones whose name matches the given regex.',
      '    --test-out=<path>',
      '      Where to write the output from a test run in addition to writing to the',
      '      console. (If not specified, will just write to the console.)',
      '',
      `${progName} [--help | -h]`,
      '  Display this message.'
    ].forEach((line) => {
      // eslint-disable-next-line no-console
      console.log(line);
    });
  }

  /**
   * Parses the options.
   *
   * @param {array<string>} argv Command-line argument array, in the format
   *   provided by `process.argv`.
   * @returns {object} An ad-hoc plain object representing the parsed results.
   */
  static _parseOptions(argv) {
    const result = {
      action:       'production',
      errorMessage: null,
      humanConsole: false,
      progName:     path.basename(argv[1]),
      testFilter:   null,
      testOut:      null
    };

    // Produce basic form of parsed options. **Note:** The `slice` gets rid of
    // the `node` binary name and the name of the initial script.
    const opts = minimist(argv.slice(2), {
      boolean: Action.ACTIONS.concat([
        'human-console'
      ]),
      string: [
        'prog-name',
        'test-filter',
        'test-out'
      ],
      alias: {
        'h': 'help'
      },
      stopEarly: true,
      unknown: (arg) => {
        result.errorMessage = `Unrecognized option: ${arg}`;
        return false;
      }
    });

    if (result.errorMessage !== null) {
      return result;
    }

    result.humanConsole = opts['human-console'] || false;

    let gotAction = false;
    for (const a of Action.ACTIONS) {
      if (!opts[a]) {
        continue;
      } else if (gotAction) {
        result.errorMessage = 'Cannot specify multiple action options.';
        return result;
      }

      gotAction = true;
      result.action = a;
    }

    const testFilter = opts['test-filter'];
    if (testFilter) {
      if (!/-test$/.test(result.action)) {
        result.errorMessage =
          'Cannot specify `--test-filter` except when running a `*-test` action.';
        return result;
      }

      result.testFilter = new RegExp(testFilter);
    }

    const testOut = opts['test-out'];
    if (testOut) {
      if (!/-test$/.test(result.action)) {
        result.errorMessage =
          'Cannot specify `--test-out` except when running a `*-test` action.';
        return result;
      }

      result.testOut = path.resolve(testOut);
    }

    return result;
  }
}
