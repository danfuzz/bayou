// Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { TFunction, TString } from 'typecheck';
import { CommonBase } from 'util-common';

/** {string} The "class" tag used for regular arrays. */
const ARRAY_TAG = 'array';

/**
 * Methods for registering and looking up classes by name. The names are what
 * are how classes are identified when encoding and decoding instances on
 * the wire (for API transmission and receipt, and for storage to disk or in
 * a database).
 *
 * Every class registered through this mechanism must define a property
 * `API_NAME` and a static method `fromApi()`. In addition, instances to be
 * encoded must define a method `toApi()`. These are all used as described
 * elsewhere in this module.
 */
export default class Regsitry extends CommonBase {
  /**
   * Constructs the instance.
   */
  constructor() {
    super();

    /**
     * Map of registered class names to their respective classes. **Note:** The
     * constructor argument prevents the `array` tag from getting improperly
     * registered (by client code).
     */
    this._registry = new Map([[ARRAY_TAG, null]]);
  }

  /** {string} The "class" tag used for regular arrays. */
  get arrayTag() {
    return ARRAY_TAG;
  }

  /**
   * Registers a class to be accepted for API use.
   *
   * @param {object} clazz The class to register.
   */
  registerClass(clazz) {
    const apiName = TString.check(clazz.API_NAME);
    TFunction.check(clazz.fromApi);
    TFunction.check(clazz.prototype.toApi);

    if (this._registry.get(apiName)) {
      throw new Error(`Cannot re-register class name \`${apiName}\`.`);
    }

    this._registry.set(apiName, clazz);
  }

  /**
   * Finds a previously-registered class by name. This throws an error if there
   * is no registered class with the given name.
   *
   * @param {string} name The class name.
   * @returns {class} The class that was registered under the given name.
   */
  classForName(name) {
    const result = this._registry.get(name);

    if (!result) {
      throw new Error(`No class registered with name \`${name}\`.`);
    }

    return result;
  }
}
