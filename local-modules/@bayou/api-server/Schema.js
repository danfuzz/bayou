// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TObject, TString } from '@bayou/typecheck';
import { PropertyIterable } from '@bayou/util-common';

/**
 * Schema for an object. Represents what actions are available. More
 * specifically:
 *
 * * Non-method properties are excluded. (This may change in the future.)
 * * Static methods are excluded. (This may change in the future.)
 * * Methods whose names start with an underscore (`_`) are excluded.
 * * Methods whose names are symbols (e.g. `Symbol('foo')`) are excluded.
 * * Constructor methods are excluded.
 * * Methods inherited from the base `Object` prototype are excluded.
 * * All other public methods are included.
 */
export default class Schema {
  /**
   * Constructs an instance based on the given object.
   *
   * **Note:** The resulting instance doesn't remember (keep a reference to) the
   * target object. (The class {@link Target} does that.)
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

    Object.freeze(this);
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
    TString.nonEmpty(name);
    const result = this._properties.get(name);

    return result || null;
  }

  /**
   * Generates the actual property map (schema payload) for the given object.
   *
   * @param {object} target Object from which to derive the schema.
   * @returns {Map<string, string>} The corresponding property map.
   */
  static _makeSchemaFor(target) {
    const result = new Map();

    for (const desc of new PropertyIterable(target).skipObject().onlyMethods()) {
      const name = desc.name;

      if ((typeof name !== 'string') || name.match(/^_/) || (name === 'constructor')) {
        // Because we don't want properties whose names aren't strings (that is,
        // are symbols), are prefixed with `_`, or are constructor functions. In
        // all cases these are effectively private with respect to the API
        // boundary.
        continue;
      }

      result.set(name, 'method');
    }

    return result;
  }
}
