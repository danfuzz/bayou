// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject, TString } from 'typecheck';
import { PropertyIter } from 'util-common';

/**
 * Schema for an object. Represents what actions are available. More
 * specifically:
 *
 * * Methods whose names start with an underscore (`_`) are excluded from
 *   schemas.
 * * Constructor methods are excluded from schemas.
 * * Methods inherited from the base `Object` prototype are excluded from
 *   schemas.
 * * All other public methods are included in schemas.
 * * Static methods are excluded from schemas. (This may change in the future.)
 * * Non-method properties are excluded from schemas. (This may change in the
 *   future.)
 */
export default class Schema {
  /**
   * Constructs an instance based on the given object. **Note:** The resulting
   * instance doesn't remember (keep a reference to) the target object.
   *
   * @param {object} target Object from which to derive the schema.
   */
  constructor(target) {
    TObject.check(target);

    /**
     * {Map<string, string>} Map from each name to a property descriptor
     * string.
     */
    this._properties = Schema._makeSchemaFor(target);
  }

  /**
   * Generates the actual property map (schema payload) for the given object.
   *
   * @param {object} target Object from which to derive the schema.
   * @returns {Map<string, string>} The corresponding property map.
   */
  static _makeSchemaFor(target) {
    const result = new Map();

    for (const desc of new PropertyIter(target).skipObject().onlyMethods()) {
      const name = desc.name;

      if (name.match(/^_/) || (name === 'constructor')) {
        // Because we don't want properties whose names are prefixed with `_`,
        // and we don't want to expose the constructor function.
        continue;
      }

      result.set(name, 'method');
    }

    return result;
  }

  /**
   * Gets the descriptor for the property with the given name. This will return
   * `null` if there is no such property. The defined descriptors are:
   *
   * * `method` -- It is an instance method.
   *
   * In the future, other descriptors may also be defined.
   *
   * @param {string} name Property name.
   * @returns {string|null} Corresponding property descriptor or `null` if there
   *   is none.
   */
  getDescriptor(name) {
    TString.nonempty(name);
    const result = this._properties.get(name);

    return result || null;
  }

  /**
   * Returns a plain object (JSON-encodable map) for the property map of this
   * instance.
   *
   * @returns {object<string, string>} The plain object representation.
   */
  get propertiesObject() {
    const result = {};
    for (const [key, value] of this._properties) {
      result[key] = value;
    }

    return Object.freeze(result);
  }
}
