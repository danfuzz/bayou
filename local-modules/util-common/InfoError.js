// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import { TString } from 'typecheck';

import DataUtil from './DataUtil';

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
 * we can't just mix it in here. Instead, `CommonBase` does that during its own
 * initialization.
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
    TString.check(name);
    return (value instanceof InfoError) && (value.name === name);
  }

  /**
   * Makes a message for passing to the superclass constructor.
   *
   * @param {array<*>} detailsArgs The detail arguments.
   * @returns {string} An appropriately-constructed message string.
   */
  static _makeMessage(detailsArgs) {
    // As an array, the inspected form is `[...]` (square brackets). We replace
    // the ends with parens.
    const argString = util.inspect(detailsArgs)
      .replace(/^\[ */, '(')
      .replace(/ *\]$/, ')');

    return argString;
  }

  /**
   * Constructs an instance. JSDoc doesn't have enough expressiveness to
   * describe the arguments, so here is a more complete description:
   *
   * The constructor accepts an _optional_ cause `Error`, followed by a
   * mandatory detail schema name, followed by any number of additional detail
   * values, whose interpretation is defined by the name. All detail values must
   * be simple data (e.g. JSON-codable).
   *
   * The name must conform to the usual syntax for a programming language
   * "identifier," that is, a non-empty string with characters taken from the
   * set `[a-zA-Z_0-9]` and a non-numeric first character.
   *
   * @param {Error|string} firstArg _Either_ the causal `Error` or the detail
   *   schema name
   * @param {...*} args Additional arguments, as described above.
   */
  constructor(firstArg, ...args) {
    // "Parse" the constructor arguments first, so we can make an appropriate
    // call to `super()` (which is required before setting instance variables.)
    const hasCause    = (firstArg instanceof Error);
    const cause       = hasCause ? firstArg : null;
    const detailsName = TString.identifier(hasCause ? args[0] : firstArg);
    const detailsArgs = DataUtil.deepFreeze(hasCause ? args.slice(1) : args);

    // **Note:** `Error.toString()` includes the contents of `error.name`, so
    // we _don't_ want to include the name in the message we pass up to the
    // superclass constructor. If we did so, the stringified version of the
    // instance would have the name listed twice.
    super(InfoError._makeMessage(detailsArgs));

    /** {Error|null} The causal error, if any. */
    this._cause = cause;

    /** {string} The detail schema name. */
    this._name = detailsName;

    /** {array<*>} The detail arguments. */
    this._args = detailsArgs;

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

  /**
   * {string} The name of the detail schema. This can be thought of as the
   * "type" or "kind" of error.
   */
  get name() {
    return this._name;
  }

  /**
   * {array<*>} Array of arguments that provide details corresponding to the
   * schema name. Guaranteed to be deep-frozen.
   */
  get args() {
    return this._args;
  }
}
