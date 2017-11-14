// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { InfoError } from 'util-common';

/**
 * Error which can be encoded and decoded across an API boundary.
 *
 * **Note:** We intentionally exclude stack trace info from the encoded form,
 * because that can be security-sensitive.
 */
export default class CodableError extends InfoError {
  /** {string} Name of this class for the sake of API coding. */
  static get CODEC_TAG() {
    return 'Error';
  }

  /**
   * Constructs an instance. Arguments are the same as for {@link InfoError}.
   *
   * **Note:** If a `cause` argument is given, the constructed instance will
   * convert it to an instance of this class if it isn't given as one.
   *
   * @param {...*} args Construction arguments.
   */
  constructor(...args) {
    if (args[0] instanceof Error) {
      args[0] = CodableError._fixError(args[0]);
    }

    super(...args);
  }

  /**
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array} Reconstruction arguments.
   */
  deconstruct() {
    return (this.cause === null) ? [this.info] : [this.cause, this.info];
  }

  /**
   * Custom inspector function, as called by `util.inspect()`. This just returns
   * the info portion instead of also including the stack trace, since the stack
   * trace is meaningless on instances of this class (they will typically just
   * indicate that there is an object graph that's in the middle of being
   * decoded).
   *
   * @param {Int} depth_unused Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth_unused, opts) {
    // Set up the inspection opts so that recursive calls respect the topmost
    // requested depth.
    const subOpts = (opts.depth === null)
      ? opts
      : Object.assign({}, opts, { depth: opts.depth - 1 });

    return `${this.constructor.name}: ${inspect(this.info, subOpts)}`;
  }

  /**
   * "Fixes" an error so that it is an instance of this class. Returns the given
   * value if already an appropriate instance.
   *
   * @param {Error} error The error to fix.
   * @returns {CodableError} The fixed instance.
   */
  static _fixError(error) {
    if (error instanceof CodableError) {
      // No conversion necessary.
      return error;
    }

    if (error instanceof InfoError) {
      if (error.cause === null) {
        return new CodableError(error.info);
      } else {
        return new CodableError(error.cause, error.info);
      }
    }

    // It's an `Error` outside of the control of this system. The best we can do
    // is re-encapsulate its `name` and `message`.
    return new CodableError('general_error', error.name, error.message);
  }
}
