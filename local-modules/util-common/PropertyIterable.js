// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction } from 'typecheck';
import { CommonBase } from 'util-core';

/**
 * Iterable over object properties. Instances walk over all properties of the
 * objects they are given, whether enumerable or not. The values yielded by
 * the iterator are the same as defined by `Object.getOwnPropertyDescriptor()`,
 * with the addition of a bindings of `name` to the property name (which can be
 * either a string or a symbol) and `target` to the target object (either the
 * top-level object or an element in its prototype chain).
 */
export default class PropertyIterable extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {object} object What to iterate over.
   * @param {function|null} [filter = null] Filter to select which properties
   *   are of interest. Gets called with a single argument, namely the
   *   `name`-augmented property descriptor as described in the class header.
   *   Expected to return `true` (or truthy) for properties that are to be
   *   selected.
   */
  constructor(object, filter = null) {
    super();

    /** The object to iterate over. */
    this._object = object;

    /** The filter. */
    this._filter = filter;
  }

  /**
   * Gets an instance that is like this one but with an additional filter, as
   * specified.
   *
   * @param {function} filter The additional filter.
   * @returns {PropertyIterable} The new iterator.
   */
  filter(filter) {
    const origFilter = this._filter;
    const newFilter = origFilter
      ? (desc => (origFilter(desc) && filter(desc)))
      : filter;

    return new PropertyIterable(this._object, newFilter);
  }

  /**
   * Gets an instance that is like this one but with an addition filter that
   * only passes methods (non-synthetic function-valued properties).
   *
   * @returns {PropertyIterable} The new iterator.
   */
  onlyMethods() {
    // **Note:** If `value` is defined, the property is guaranteed not to be
    // synthetic.
    return this.filter(desc => TFunction.isCallable(desc.value));
  }

  /**
   * Gets an instance that is like this one but with an addition filter that
   * skips methods (non-synthetic function-valued properties).
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipMethods() {
    // **Note:** If `value` is defined, the property is guaranteed not to be
    // synthetic.
    return this.filter(desc => (typeof desc.value) !== 'function');
  }

  /**
   * Gets an instance that is like this one but with an addition filter that
   * skips properties defined on the root `Object` prototype.
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipObject() {
    return this.filter(desc => (desc.target !== Object.prototype));
  }

  /**
   * Gets an instance that is like this one but with an addition filter that
   * skips properties in "private" form (that is, prefixed with `_`).
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipPrivate() {
    return this.filter(desc => !/^_/.test(desc.name));
  }

  /**
   * Gets an instance that is like this one but with an addition filter that
   * only passes regular non-synthetic properties.
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipSynthetic() {
    return this.filter(desc => !(desc.get || desc.set));
  }

  /**
   * Gets an iterator which iterates over this instance's object's properties.
   *
   * @yields {object} The property descriptors.
   */
  * [Symbol.iterator]() {
    const filter = this._filter;
    let   object = this._object;

    // Keeps track of properties already covered, so as not to yield properties
    // shadowed by a superclass.
    const covered = new Map();

    while (object) {
      const names = Object.getOwnPropertyNames(object);
      for (const name of names) {
        if (covered.get(name)) {
          continue;
        }
        covered.set(name, true);
        const desc = Object.getOwnPropertyDescriptor(object, name);
        desc.name   = name;
        desc.target = object;
        if (filter && !filter(desc)) {
          continue;
        }
        yield desc;
      }

      const symbols = Object.getOwnPropertySymbols(object);
      for (const symbol of symbols) {
        if (covered.get(symbol)) {
          continue;
        }
        covered.set(symbol, true);
        const desc = Object.getOwnPropertyDescriptor(object, symbol);
        desc.name   = symbol;
        desc.target = object;
        if (filter && !filter(desc)) {
          continue;
        }
        yield desc;
      }

      object = Object.getPrototypeOf(object);
    }
  }
}
