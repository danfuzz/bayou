// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import CoreTypecheck from './CoreTypecheck';
import Functor from './Functor';

/**
 * `Error` subclass that comes with additional structured information.
 * Specifically, instances have mandatory "details" which take the form of a
 * functor (in this case a string name and optional arguments) and optionally
 * indicate a different error that was the "cause" of this one.
 *
 * The point of this is to be able to instantiate errors along the lines of
 * `new InfoError('file_not_found', '/foo/bar/baz.txt')` where the error comes
 * with a name and associated info in a well-defined form such that other code
 * can succeed in doing something useful with it, should it be useful to do so.
 *
 * **Note:** This class mixes in `CommonBase`, so that it gets the static
 * `check()` method and friends. However, because `CommonBase` uses this class,
 * we can't just mix it in here (as this class is the one that gets initialized
 * first). Instead, this happens during module initialization.
 */
export default class InfoError extends Error {
  /**
   * Checks if the given value is an instance of this class with the given
   * name. This is a `static` method, so that the check can be made on errors
   * in general, without having to check up front whether they are instances of
   * this class.
   *
   * @param {*} value Value to check.
   * @param {string} name Error name.
   * @returns {boolean} `true` if `value` is an instance of this class with the
   *   indicated name.
   */
  static hasName(value, name) {
    CoreTypecheck.checkString(name);
    return (value instanceof InfoError) && (value.info.name === name);
  }

  /**
   * Constructs an instance. JSDoc doesn't have enough expressiveness to
   * describe the arguments, so here is a more complete description:
   *
   * The constructor accepts an _optional_ cause `Error`, followed by either:
   *
   * * a functor containing the error information.
   * * one or more arguments which can be passed to the `Functor` constructor,
   *   for an instance containing the error information.
   *
   * Interpretation of the arguments is (informally) defined by the functor
   * name.
   *
   * @param {...*} args Arguments, as described above.
   */
  constructor(...args) {
    // Parse the constructor arguments first, so we can make an appropriate
    // call to `super()` (which is required before setting instance variables.)

    const cause = (args[0] instanceof Error) ? args[0] : null;
    if (cause !== null) {
      args = args.slice(1);
    }

    const info = (args[0] instanceof Functor) ? args[0] : new Functor(...args);

    super(info.toString());

    /** {Error|null} The causal error, if any. */
    this._cause = cause;

    /** {Functor} The error info payload. */
    this._info = info;

    if (this._cause !== null) {
      // Append the cause's stack to this instance's. **TODO:** Figure out if
      // we can do this lazily, which would mean somehow both overriding
      // `.stack` _and_ being able to get its originally-set value.
      this.stack += `\ncaused by:\n${this._cause.stack}`;
    }

    Object.freeze(this);
  }

  /**
   * {Error|null} The error that "caused" this one, or `null` if there is no
   * causative error.
   */
  get cause() {
    return this._cause;
  }

  /** {Functor} The error information payload. */
  get info() {
    return this._info;
  }
}
