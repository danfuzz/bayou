// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { CoreTypecheck } from './CoreTypecheck';
import { Functor } from './Functor';

/**
 * `Error` subclass that comes with additional structured information.
 * Specifically, instances have mandatory "details" which take the form of a
 * functor (in this case a string name and optional arguments) and optionally
 * indicate a different error that was the "cause" of this one.
 *
 * The point of this is to be able to instantiate errors along the lines of
 * `new InfoError('fileNotFound', '/foo/bar/baz.txt')` where the error comes
 * with a name and associated info in a well-defined form such that other code
 * can succeed in doing something useful with it, should it be useful to do so.
 *
 * **Note:** This class mixes in `CommonBase`, so that it gets the static
 * `check()` method and friends. However, because `CommonBase` uses this class,
 * we can't just mix it in here (as this class is the one that gets initialized
 * first). Instead, this happens during module initialization. (See `index.js`
 * in this module.)
 */
export class InfoError extends Error /* mixin CommonBase */ {
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

    /**
     * {array<string>} Array of stack trace line items, in canonical form. See
     * {@link #_stackLines} for details.
     */
    this._stack = InfoError._stackLines(this.stack);

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

  /**
   * {string} The name of the error. This is expected by the default `Error`
   * implementation.
   */
  get name() {
    return this.constructor.name;
  }

  /**
   * Custom inspector function, as called by `util.inspect()`. This
   * implementation is similar to the default `Error` inspector, except that
   * this one formats the first line in a nicer way given the structured error
   * content.
   *
   * @param {Int} depth_unused Current inspection depth. **Note:** This
   *   implementation mimics the behavior of the default implementation in that
   *   it includes the stack trace even when `depth` is `0`.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth_unused, opts) {
    // Set up the inspection opts so that recursive calls respect the topmost
    // requested depth.
    const subOpts = (opts.depth === null)
      ? opts
      : Object.assign({}, opts, { depth: opts.depth - 1 });


    const result = [
      this.constructor.name,
      ': ',
      inspect(this._info, subOpts),
      '\n'
    ];

    for (const l of this._stack) {
      result.push('  at ');
      result.push(l);
      result.push('\n');
    }

    if (this._cause !== null) {
      result.push('caused by:\n');
      // `opts` and not `subOpts` so that the cause is inspected at the same
      // depth (which makes reasonable sense, as it's more of a linear than a
      // recursive thing, in context).
      result.push(inspect(this._cause, opts));
    }

    return result.join('').replace(/\n+$/, '');
  }

  /**
   * Gets a concise string form of this instance.
   *
   * @returns {string} String form of this instance.
   */
  toString() {
    return `${this.constructor.name}: ${this._info}`;
  }

  /**
   * Gets an array of stack lines from an original `.stack` string. This is
   * meant to work cross-platform, taking into account known differences between
   * Chrome / Chromium and Safari.
   *
   * **TODO:** This should be removed and call sites fixed to use
   * {@link UtilError#stackLines()}, except that method would have to be fixed
   * to be (a) accessible here (wrong module) and (b) become explicitly aware of
   * Safari's style.
   *
   * @param {string} orig The original `.stack` string.
   * @returns {array<string>} Array of trace items.
   */
  static _stackLines(orig) {
    const lines = orig.split('\n');

    if (lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (lines.length === 0) {
      return lines;
    }

    if (/^    at /.test(lines[lines.length - 1])) {
      // Chrome / Chromium style, which means its first line is a recapitualtion
      // of the error name and message. We also want to strip off all the `at`s.
      lines.shift();
      for (let i = 0; i < lines.length; i++) {
        lines[i] = lines[i].slice(7);
      }
    }

    return lines;
  }
}
