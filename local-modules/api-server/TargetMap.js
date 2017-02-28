// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject } from 'typecheck';

import Target from './Target';

/**
 * Map of names to `Target` instances.
 *
 * As a convention, `main` is the object providing the main functionality, and
 * `meta` provides meta-information and meta-control.
 */
export default class TargetMap {
  /**
   * Checks that a value is an instance of this class. Throws an error if not.
   *
   * @param {*} value Value to check.
   * @returns {DocumentChange} `value`.
   */
  static check(value) {
    return TObject.check(value, TargetMap);
  }

  /**
   * Constructs an instance which initially has a single target bound to `main`.
   *
   * @param {object} target The target.
   * @returns {TargetMap} An appropriately-constructed instance.
   */
  static singleTarget(target) {
    const result = new TargetMap();
    result.add(new Target('main', target));
    return result;
  }

  /**
   * Constructs an instance which is initially empty.
   */
  constructor() {
    /** {Map<string,Target>} The underlying map. */
    this._map = new Map();

    Object.freeze(this);
  }

  /**
   * Adds a new entry to the map. This will throw an error if there is already
   * another target with the same name.
   *
   * @param {Target} target Target to add.
   */
  add(target) {
    const name = target.name;

    if (this._map.get(name) !== undefined) {
      throw new Error(`Duplicate target: \`${name}\``);
    }

    this._map.set(name, target);
  }

  /**
   * Gets the target associated with the indicated name. This will throw an
   * error if the named target does not exist.
   *
   * @param {string} name The target name.
   * @returns {object} The so-named target.
   */
  get(name) {
    const result = this._map.get(name);

    if (result === undefined) {
      throw new Error(`No such target: \`${name}\``);
    }

    return result;
  }

  /**
   * Clones this instance. The resulting clone has a separate underlying map.
   * That is, adding targets to the clone does not affect its progenitor.
   *
   * @returns {TargetMap} The newly-cloned instance.
   */
  clone() {
    const result = new TargetMap();

    for (const t of this._map.values()) {
      result.add(t);
    }

    return result;
  }
}
