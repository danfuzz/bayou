// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { inspect } from 'util';

import { CoreTypecheck } from './CoreTypecheck';
import { DataUtil } from './DataUtil';
import { Errors } from './Errors';
import { FrozenBuffer } from './FrozenBuffer';
import { ObjectUtil } from './ObjectUtil';

/**
 * Functor data value. A "functor," generally speaking, is a thing that looks
 * like a function call. In this case, it consists of a string name and a
 * list of zero or more positional argument values. Instances are immutable.
 *
 * When rendered as a string, instances of this class look like function calls,
 * e.g., `someName(1, 2, 'foo')`.
 *
 * **Note:** This class mixes in `CommonBase`, so that it gets the static
 * `check()` method and friends. However, because `CommonBase` uses this class,
 * we can't just mix it in here (as this class is the one that gets initialized
 * first). Instead, this happens during module initialization. (See `index.js`
 * in this module.)
 *
 * **Note for pedants:** This class does _not_ implement a "functor" in the
 * strict mathematical or category-theoretical sense of the word.
 */
export class Functor /* extends CommonBase */ {
  /**
   * Constructs an instance.
   *
   * @param {string} name Functor name. This must conform to the "label"
   *   syntax as defined by {@link TString#label()}.
   * @param {...*} args Functor arguments.
   */
  constructor(name, ...args) {
    /** {string} Functor name. */
    this._name = CoreTypecheck.checkLabel(name);

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
   * Gets reconstruction arguments for this instance.
   *
   * @returns {array<*>} Reconstruction arguments.
   */
  deconstruct() {
    return [this._name, ...this._args];
  }

  /**
   * Custom inspector function, as called by `util.inspect()`.
   *
   * @param {Int} depth Current inspection depth.
   * @param {object} opts Inspection options.
   * @returns {string} The inspection string form of this instance.
   */
  [inspect.custom](depth, opts) {
    if (depth < 0) {
      // Minimal expansion if we're at the depth limit.
      return `${this._name}(${this._args.length === 0 ? '' : '...'})`;
    }

    // Set up the inspection opts so that recursive calls respect the topmost
    // requested depth.
    const subOpts = (opts.depth === null)
      ? opts
      : Object.assign({}, opts, { depth: opts.depth - 1 });
    const result = [this._name, '('];

    let first = true;
    for (const a of this._args) {
      if (first) {
        first = false;
      } else {
        result.push(', ');
      }
      result.push(inspect(a, subOpts));
    }

    result.push(')');
    return result.join('');
  }

  /**
   * Compares this to another value for equality. Instances of this class are
   * only considered to be equal to other direct instances of this class. (This
   * class is not meant to be subclassed.) Given two instances of this class,
   * in order to be considered equal, the following must hold:
   *
   * * Their names must be strictly equal.
   * * Their argument array lengths must be the same.
   * * Each pair of corresponding arguments must be equal, by one of the
   *   following tests (performed in order):
   *   * The arguments must be strictly equal.
   *   * The arguments must be equal as defined by `DataUtil.equalData()`.
   *   * The argument of this instance must define a `.equal()` method which
   *     returns `true` when passed the argument of the other instance.
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
      const arg1 = thisArgs[i];
      const arg2 = otherArgs[i];
      if ((arg1 !== arg2) && !DataUtil.equalData(arg1, arg2)) {
        if (   (arg1 === null)
            || (typeof arg1 !== 'object')
            || (typeof arg1.equals !== 'function')
            || !arg1.equals(arg2)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Gets an instance just like this one except with all arguments guaranteed to
   * be _either_ deep-frozen data values or already-frozen non-plain / non-array
   * objects. If all arguments are already conformant, this method returns
   * `this`. Otherwise, it will freeze non-frozen data arguments using {@link
   * DataUtil#deepFreeze}, and will throw an error if given any other non-frozen
   * values.
   *
   * @returns {Functor} A frozen-argument version of `this`.
   */
  withFrozenArgs() {
    const args = [];
    let   any  = false;

    for (const a of this._args) {
      let newArg;
      if (Array.isArray(a) || ObjectUtil.isPlain(a)) {
        newArg = DataUtil.deepFreeze(a);
      } else if (a instanceof FrozenBuffer) {
        newArg = a;
      } else if (Object.isFrozen(a)) {
        newArg = a;
      } else {
        throw Errors.badUse('Non-frozen non-data argument.');
      }

      args.push(newArg);
      if (a !== newArg) {
        any = true;
      }
    }

    return any ? new Functor(this._name, ...args) : this;
  }
}
