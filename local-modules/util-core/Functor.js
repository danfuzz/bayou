// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import util from 'util';

import CoreTypecheck from './CoreTypecheck';

/**
 * Functor data value. A "functor," generally speaking, is a thing that looks
 * like a function call. In this case, it consists of a string name and a
 * list of zero or more positional argument values. Instances are immutable.
 *
 * When rendered as a string, instances of this class look like function calls,
 * e.g., `someName(1, 2, 'foo')`.
 */
export default class Functor {
  /**
   * Constructs an instance.
   *
   * @param {string} name Functor name. This must conform to the usual
   *   conservative syntax for a programming language "identifier," that is, a
   *   non-empty string with characters taken from the set `[a-zA-Z_0-9]` and a
   *   non-numeric first character.
   * @param {...*} args Functor arguments.
   */
  constructor(name, ...args) {
    /** {string} Functor name. */
    this._name = CoreTypecheck.checkIdentifier(name);

    /** {array<*>} Functor arguments. */
    this._args = Object.freeze(args);

    Object.freeze(this);
  }

  /**
   * {array<*>} Array of arguments. It is a frozen (immutable) value, though its
   * contents might not also be frozen.
   */
  get args() {
    return this._args;
  }

  /** {string} The functor name. */
  get name() {
    return this._name;
  }

  /**
   * Custom inspector function, as called by `util.inspect`.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [util.inspect.custom](depth, opts) {
    if (depth < 0) {
      return `${this._name}(${this._args.length === 0 ? '' : '...'})`;
    }

    const result = [this._name, '('];

    if (depth < 0) {
      // Minimal expansion if we're at the depth limit.
      if (this._args.length !== 0) {
        result.push('...');
      }
    } else {
      // Set up the inspection opts so that recursive calls respect the topmost
      // requested depth.
      const subOpts = (opts.depth === null)
        ? opts
        : Object.assign({}, opts, { depth: opts.depth - 1 });

      let first = true;
      for (const a of this._args) {
        if (first) {
          first = false;
        } else {
          result.push(', ');
        }
        result.push(util.inspect(a, subOpts));
      }
    }

    result.push(')');
    return result.join('');
  }

  /**
   * Compares this to another value for equality. Instances of this class are
   * only considered to be equal to other direct instances of this class. (This
   * class is not meant to be subclassed.) Given two instances of this class,
   * their names must be strictly equal, their argument array lengths must be
   * the same, and corresponding arguments must be strictly equal.
   *
   * @param {*} other Value to compare to.
   * @returns {boolean} `true` if `other` is equal to this instance, or `false`
   *   if not.
   */
  equals(other) {
    if (this === other) {
      // Easy out.
      return true;
    } else if (!(other instanceof Functor) || (other.constructor !== Functor)) {
      return false;
    }

    const thisArgs = this._args;
    const otherArgs = other._args;

    if ((this._name !== other._name) || (thisArgs.length !== otherArgs.length)) {
      return false;
    }

    for (let i = 0; i < thisArgs.length; i++) {
      if (thisArgs[i] !== otherArgs[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the string form of this instance. This uses `util.inspect()` on the
   * elements of the `args` array.
   *
   * @returns {string} The string form of this instance.
   */
  toString() {
    return util.inspect(this, { breakLength: Infinity });
  }
}
