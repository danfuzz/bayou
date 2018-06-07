// Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import path from 'path';
import minimist from 'minimist';

import { Singleton } from '@bayou/util-common';

/**
 * {array<string>} Allowed top-level actions. See the usage text for details
 * about what each means.
 */
const ACTIONS = Object.freeze([
  'client-bundle',
  'client-test',
  'dev',
  'dev-if-appropriate',
  'help',
  'production',
  'server-test'
]);

/**
 * Command-line option parsing. Accessing the singleton instance causes options
 * to be parsed.
 */
export default class Options extends Singleton {
  /**
   * Constructs an instance, which in the process parses the command-line
   * options.
   */
  constructor() {
    super();

    this._options = Object.freeze(Options._parseOptions());
  }

  /**
   * Writes the usage message to the console. **Note:** This is an instance
   * method because it mentions the program name.
   */
  usage() {
    const progName = this._options.progName;

    [
      'Usage:',
      '',
      `${progName} [--client-bundle | --client-test | --dev | --dev-if-appropriate |`,
      '  --production | --server-test] [--human-console] [--prog-name=<name>] ',
      '  [--test-out=<path>]',
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
      '      indicates that it is meant to be so run. (This is determined by a hook in',
      '      the `@bayou/hooks-server` module, see which.) If not appropriate to run',
      '      in development mode, this will run in production mode.',
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
   * @returns {object} An ad-hoc plain object representing the parsed results.
   */
  static _parseOptions() {
    const result = {
      action:       'run',
      errorMessage: null,
      humanConsole: false,
      progName:     path.basename(process.argv[1]),
      testOut:      null
    };

    // Produce basic form of parsed options. **Note:** The `slice` gets rid of
    // the `node` binary name and the name of the initial script.
    const opts = minimist(process.argv.slice(2), {
      boolean: ACTIONS.concat([
        'human-console'
      ]),
      string: [
        'prog-name',
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
    for (const a of ACTIONS) {
      if (!opts[a]) {
        continue;
      } else if (gotAction) {
        result.errorMessage = 'Cannot specify multiple action options.';
        return result;
      }

      gotAction = true;
      result.action = a;
    }

    const testOut = opts['test-out'];
    if (testOut) {
      if (!result.action.test(/-test$/)) {
        result.errorMessage =
          'Cannot specify `--test-out` except when running a `--test-*` action.';
        return result;
      }

      result.testOut = path.resolve(testOut);
    }

    return result;
  }
}
