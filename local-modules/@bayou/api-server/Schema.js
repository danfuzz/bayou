// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TArray, TBoolean, TObject, TString } from '@bayou/typecheck';
import { CommonBase, ObjectUtil, PropertyIterable } from '@bayou/util-common';

/**
 * {RegExp} Expression that matches method names that are _not_ to be offered
 * across an API boundary. Specifically, we don't support directly promise-like
 * behavior across an API boundary. (Though note, on the client side all exposed
 * methods return promises that are implemented locally.)
 */
const VERBOTEN_NAMES = /^(then|catch)$/;

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
 *
 * Instances of this class also provide information about how to log calls to
 * methods, specifically with regards to redaction. This is driven by getters
 * defined on the _class_ of the target, with names of the form
 * `_loggingFor_<name>`, where `<name>` is the method name. These getters should
 * each return a plain object that binds `args` (to an array of booleans) and/or
 * `result` (to a boolean). See {@link #loggingForArgs},
 * {@link #loggingForResult}, and {@link Target} for details about how these are
 * used.
 */
export class Schema extends CommonBase {
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

    super();

    const clazz = target.constructor;

    /**
     * {class|null} Class of the target, if it has a class (other than
     * `Object`).
     */
    this._clazz = (clazz && (clazz !== Object)) ? clazz : null;

    /**
     * {Map<string, string>} Map from each name to a property descriptor
     * string.
     */
    this._properties = Schema._makeSchemaFor(target);

    /**
     * {Map<string, object>} Map from each name to its logging metadata.
     * Populated on-demand as a cache.
     */
    this._logging = new Map();

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
   * Indicates which arguments of a call to the named method should be logged,
   * when performing redaction in general.
   *
   * **TODO:** Right now this is an array of all-or-nothing booleans, but in the
   * future we might want to have a more structured redaction spec (e.g., if an
   * argument is a plain object, which properties of that object to redact).
   *
   * @param {string} name Method name.
   * @returns {array<boolean>} Array which indicates, for each (positional)
   *   argument, whether (`true`) or not (`false`) to log the argument. If there
   *   are more actual arguments than elements of the result of this call,
   *   "extra" arguments should _not_ be logged so as to fail safe.
   */
  loggingForArgs(name) {
    return this._getLogging(name).args;
  }

  /**
   * Indicates whether the result of calling the named method should be
   * logged, when performing redaction in general.
   *
   * **TODO:** Right now this is an all-or-nothing boolean, but in the future we
   * might want to have a more structured redaction spec (e.g., if the return
   * value is a plain object, which properties to redact).
   *
   * @param {string} name Method name.
   * @returns {boolean} Whether (`true`) or not (`false`) to log the result
   *   of calling the so-named method.
   */
  loggingForResult(name) {
    return this._getLogging(name).result;
  }

  /**
   * Gets the logging metadata for the given property. This provides sensible
   * fail-safe default results when the metadata was not proactively defined.
   *
   * @param {string} name Property (method) name.
   * @returns {object} Logging metadata.
   */
  _getLogging(name) {
    const descriptor = this.getDescriptor(name);
    const already    = this._logging.get(name);

    if (already !== undefined) {
      return already;
    }

    // Start with fail-safe defaults.
    const result = { args: [], result: false };

    if ((descriptor !== null) && (this._clazz !== null)) {
      const logging = this._clazz[`_loggingFor_${name}`];
      if (ObjectUtil.isPlain(logging)) {
        if (typeof logging.result === 'boolean') {
          result.result = logging.result;
        }

        if (Array.isArray(logging.args)) {
          TArray.check(logging.args, x => TBoolean.check(x));
          result.args = Object.freeze(logging.args.slice());
        }
      }
    }

    Object.freeze(result);

    this._logging.set(name, result);
    return result;
  }

  /**
   * Generates the actual property map (schema payload) for the given object.
   *
   * @param {object} target Object from which to derive the schema.
   * @returns {Map<string, string>} The corresponding property map.
   */
  static _makeSchemaFor(target) {
    const result = new Map();
    const skip = (target instanceof CommonBase) ? CommonBase : Object;
    const iter =
      new PropertyIterable(target).skipClass(skip).onlyPublicMethods().skipNames(VERBOTEN_NAMES);

    for (const desc of iter) {
      result.set(desc.name, 'method');
    }

    return result;
  }
}
