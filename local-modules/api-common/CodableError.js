// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

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
   * Converts this instance to codec reconstruction arguments.
   *
   * @returns {array} Reconstruction arguments.
   */
  toCodecArgs() {
    return [this.info];
  }
}
