// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { Delay } from '@bayou/promise-util';
import { Logger, SeeAll } from '@bayou/see-all';
import { UtilityClass } from '@bayou/util-common';

/** {Logger} Logger for this file. */
const log = new Logger('top-error');

/**
 * Top-level error handling. This is what handles errors (thrown exceptions and
 * rejected promises) that percolate to the main event loop without having been
 * handled.
 */
export default class TopErrorHandler extends UtilityClass {
  /**
   * Sets up error handling.
   */
  static init() {
    process.on('unhandledRejection', TopErrorHandler._uncaughtRejection);
    process.on('uncaughtException', TopErrorHandler._uncaughtException);
  }

  /**
   * Handle either top-level problem, as indicated.
   *
   * @param {string} eventName Event name to use for logging the problem.
   * @param {string} label How to label the problem in a human-oriented `error`
   *   log.
   * @param {*} problem The "problem" (uncaught exception or rejection reason).
   *   Typically, but not necessarily, an `Error`.
   */
  static _handleProblem(eventName, label, problem) {
    // Write to `stdout` directly first, because logging might be broken.
    process.stderr.write(`${label}:\n`);
    if (problem instanceof Error) {
      process.stderr.write(problem.stack);
    } else {
      process.stderr.write(inspect(problem));
    }
    process.stderr.write('\n');

    if (SeeAll.theOne.canLog()) {
      log.error(`${label}:`, problem);
      log.event[eventName](problem);
    }

    // Give the system a moment, so it has a chance to actually flush the log,
    // and then exit.
    (async () => {
      await Delay.resolve(250); // 0.25 second.
      process.exit(1);
    })();
  }

  /**
   * Deals with a thrown exception.
   *
   * @param {*} error Whatever happened to be thrown. Typically, but not
   *   necessarily, an `Error`.
   */
  static _uncaughtException(error) {
    TopErrorHandler._handleProblem('uncaughtException', 'Uncaught exception', error);
  }

  /**
   * Deals with a rejected promise.
   *
   * @param {*} reason The "reason" for rejection. Typically, but not
   *   necessarily, an `Error`.
   * @param {Promise} promise_unused The promise that was rejected.
   */
  static _uncaughtRejection(reason, promise_unused) {
    TopErrorHandler._handleProblem('uncaughtRejection', 'Uncaught promise rejection', reason);
  }
}
