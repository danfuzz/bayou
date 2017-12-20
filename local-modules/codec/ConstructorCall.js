// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { CommonBase, Functor } from 'util-common';

/**
 * Representation of a "constructor call" encoded data form. Instances of this
 * class are used as the representation of class instances in the structured
 * values produced by {@link Codec#encode} and accepted by {@link Codec#decode}.
 * Instances of this class are always frozen (immutable).
 */
export default class ConstructorCall extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {Functor} payload Construction payload. It is a functor whose name
   *   indicates which class (or class-like-thing) to construct and whose
   *   arguments are to be passed to the salient constructor function.
   */
  constructor(payload) {
    super();

    /** {Functor} Construction payload. */
    this._payload = Functor.check(payload);

    Object.freeze(this);
  }

  /** {Functor} Construction payload. */
  get payload() {
    return this._payload;
  }
}
