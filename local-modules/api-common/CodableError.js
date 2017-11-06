// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { Functor, InfoError } from 'util-common';

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
   * Constructs an instance. Arguments are the same as for `InfoError` except
   * that an initial "cause" argument is not allowed.
   *
   * @param {Functor} info Error info.
   */
  constructor(info) {
    super(Functor.check(info));
  }

  /**
   * Custom inspector function, as called by `util.inspect()`. This just returns
   * the info portion instead of also including the stack trace, since the stack
   * trace is meaningless on instances of this class (will typically just
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
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this.info];
  }
}
