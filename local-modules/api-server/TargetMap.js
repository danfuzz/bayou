// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TString, TObject } from 'typecheck';

import Target from './Target';

/**
 * Map of IDs to `Target` instances.
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
   * Constructs an instance which is initially empty.
   */
  constructor() {
    /** {Map<string,Target>} The underlying map. */
    this._map = new Map();

    Object.freeze(this);
  }

  /**
   * Adds an already-constructed `Target` to the map. This will throw an error
   * if there is already another target with the same name.
   *
   * @param {Target} target Target to add.
   */
  addTarget(target) {
    TObject.check(target, Target);
    const id = target.id;

    if (this._map.get(id) !== undefined) {
      throw new Error(`Duplicate target: \`${id}\``);
    }

    this._map.set(id, target);
  }

  /**
   * Adds a new entry to the map. This will throw an error if there is already
   * another target with the same ID. This is a convenience for calling
   * `map.addTarget(new Target(id, obj))`.
   *
   * @param {string} id Target ID.
   * @param {object} obj Object to ultimately call on.
   */
  add(id, obj) {
    TString.nonempty(id);
    TObject.check(obj);
    this.addTarget(new Target(id, obj));
  }

  /**
   * Gets the target associated with the indicated ID. This will throw an
   * error if the so-identified target does not exist.
   *
   * @param {string} id The target ID.
   * @returns {object} The so-identified target.
   */
  get(id) {
    const result = this._map.get(id);

    if (result === undefined) {
      throw new Error(`No such target: \`${id}\``);
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
      result.addTarget(t);
    }

    return result;
  }
}
