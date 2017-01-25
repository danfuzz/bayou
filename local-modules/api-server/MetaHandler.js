// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

/**
 * Class to handle meta-requests.
 */
export default class MetaHandler {
  /**
   * Constructs an instance.
   *
   * @param {object} target The primary target object of the API.
   * @param {string} connectionId The connection ID.
   */
  constructor(target, connectionId) {
    /** The connection ID. */
    this._connectionId = connectionId;

    /** The target object. */
    this._target = target;

    /** The schema. */
    this._schema = this._makeSchema();
  }

  /**
   * API meta-method `connectionId`: Returns the connection ID that the server
   * assigned to this connection. This is only meant to be used for logging.
   * For example, it is _not_ guaranteed to be unique.
   *
   * @returns {string} The connection ID.
   */
  connectionId() {
    return this._connectionId;
  }

  /**
   * API meta-method `ping`: No-op method that merely verifies (implicitly) that
   * the connection is working. Always returns `true`.
   *
   * @returns {boolean} `true`, always.
   */
  ping() {
    return true;
  }

  /**
   * Gets a schema that represents the API served by this instance.
   *
   * @returns {object} The schema.
   */
  schema() {
    return this._schema;
  }

  /**
   * Constructs the schema.
   *
   * @returns {object} The schema.
   */
  _makeSchema() {
    const meta = MetaHandler._methodNamesFor(this);
    const methods = MetaHandler._methodNamesFor(this._target);

    return {meta, methods};
  }

  /**
   * Generates a map of the public methods callable on the given object,
   * _excluding_ those with an underscore prefix and those defined on the
   * root `Object` prototype. The result is a map from the names to the value
   * `'method'`. (In the future, the values might become embiggened.)
   *
   * @param {object} obj Object to interrogate.
   * @returns {object} The method map for `obj`.
   */
  static _methodNamesFor(obj) {
    const result = {};

    while (obj && (obj !== Object.prototype)) {
      const names = Object.getOwnPropertyNames(obj);
      for (const name of names) {
        if (result[name]) {
          // Because eventually we might have richer metainfo, and we won't want
          // to overwrite the "topmost" method definition.
          continue;
        } else if (name.match(/^_/) || (name === 'constructor')) {
          // Because we don't want properties whose names are prefixed with `_`,
          // and we don't want to expose the constructor function.
          continue;
        }

        // Inspect the property descriptor.
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc.get || desc.set) {
          // It's a synthetic member, not a method.
          continue;
        } else if (typeof desc.value !== 'function') {
          // Not a function, thus not a method.
          continue;
        }
        result[name] = 'method';
      }

      obj = Object.getPrototypeOf(obj);
    }

    return result;
  }
}
