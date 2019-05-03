// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction, TObject } from '@bayou/typecheck';
import { CommonBase } from '@bayou/util-core';

/**
 * Iterable over object properties. Instances walk over all properties of the
 * objects they are given, whether enumerable or not. The values yielded by
 * the iterator are the same as defined by `Object.getOwnPropertyDescriptor()`,
 * with the addition of a bindings of `name` to the property name (which can be
 * either a string or a symbol) and `target` to the target object (either the
 * top-level object or an element in its prototype chain).
 */
export class PropertyIterable extends CommonBase {
  /**
   * Constructs an instance.
   *
   * @param {object} object What to iterate over.
   * @param {function|null} [filter = null] Filter to select which properties
   *   are of interest. Gets called with a single argument, namely the
   *   `name`- and `target`-augmented property descriptor as described in the
   *   class header. Expected to return `true` (or truthy) for properties that
   *   are to be selected.
   */
  constructor(object, filter = null) {
    super();

    /** {object} The object to iterate over. */
    this._object = object;

    /** {function|null} The filter. */
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
   * Gets an instance that is like this one but with an additional filter that
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
   * Gets an instance that is like this one but with an additional filter which
   * only passes names that are strings (not symbols) and that must additionally
   * match the given regular expression (if given).
   *
   * @param {RegExp|null} [regex = null] Expression to use to test names.
   * @returns {PropertyIterable} The new iterator.
   */
  onlyNames(regex = null) {
    TObject.orNull(regex, RegExp);

    function filterFunc(desc) {
      const name = desc.name;

      return (typeof name === 'string')
        && ((regex === null) || regex.test(name));
    }

    return this.filter(filterFunc);
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * only passes public properties (non-synthetic properties whose names are
   * strings (not symbols) which _don't_ start with `_` and are also not the
   * special name `constructor`).
   *
   * @returns {PropertyIterable} The new iterator.
   */
  onlyPublic() {
    return this.onlyNames().skipNames(/^(_|constructor$)/);
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * only passes public methods (same as the intersection of {@link #onlyPublic}
   * and {@link #onlyMethods}).
   *
   * @returns {PropertyIterable} The new iterator.
   */
  onlyPublicMethods() {
    return this.onlyPublic().onlyMethods();
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * skips the instance properties of the indicated class and any of its
   * superclasses.
   *
   * @param {class} clazz The class whose instance properties are to be skipped.
   * @returns {PropertyIterable} The new iterator.
   */
  skipClass(clazz) {
    TFunction.checkClass(clazz);

    return this.skipTarget(clazz.prototype);
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
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
   * Gets an instance that is like this one but with an additional filter which
   * only passes names that do _not_ match the given expression. The test only
   * applies to string names; symbol-named properties all pass this filter.
   *
   * @param {RegExp} regex Expression to use to test names.
   * @returns {PropertyIterable} The new iterator.
   */
  skipNames(regex) {
    TObject.check(regex, RegExp);

    function filterFunc(desc) {
      const name = desc.name;
      return !((typeof name === 'string') && regex.test(name));
    }

    return this.filter(filterFunc);
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * skips properties defined on the root `Object` prototype.
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipObject() {
    return this.skipClass(Object);
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * only passes regular non-synthetic properties.
   *
   * @returns {PropertyIterable} The new iterator.
   */
  skipSynthetic() {
    return this.filter(desc => !(desc.get || desc.set));
  }

  /**
   * Gets an instance that is like this one but with an additional filter that
   * skips the properties of the indicated target and of all the object in its
   * prototype chain.
   *
   * @param {object} target The target to skip.
   * @returns {PropertyIterable} The new iterator.
   */
  skipTarget(target) {
    TObject.check(target);

    const targets = new Set();
    while (target !== null) {
      targets.add(target);
      target = Object.getPrototypeOf(target);
    }

    return this.filter(desc => !targets.has(desc.target));
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
